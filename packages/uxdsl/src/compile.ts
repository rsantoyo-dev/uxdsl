// compile(): the one pipeline the CLI, uxdsl/vite and uxdsl/webpack share.
//
// It runs four stages, and each may change only what it names:
//
// 1. protect (./sass/protect.ts), inside the Sass stage. In a `.uxdsl` file it
//    rewrites UXDSL's own syntax (dotted token keys such as
//    `palette(primary.main)`, `$var` inside `@ds-*(…)`) so that Dart Sass
//    passes it through, keeping a column map back to the author's text.
//    `.scss`, `.sass` and `.css` files are served as written.
// 2. Dart Sass (./sass/compile-sass.ts) compiles the entry exactly as Dart Sass
//    does: expanded style, Sass's resolution of `@use`, `@forward` and
//    `@import`, nesting, mixins, functions and control rules, so a `.scss`
//    project renamed to `.uxdsl` compiles to Dart Sass's CSS. A Sass failure is
//    `UXD_SASS`, a Sass warning `UXD_SASS_WARNING`, a project `@function`
//    that replaces a UXDSL function `UXD_FUNCTION_SHADOWED`, and a member
//    another file defines that a module loaded with `@use` cannot see,
//    compiling without an error, `UXD_MODULE_ISOLATION`. The stage always
//    produces a source map, which locates everything after it.
// 3. restore (./sass/protect.ts): `@ds-x (…)`, as Dart Sass writes an unknown
//    at-rule, becomes `@ds-x(…)` again.
// 4. The UXDSL plugin (./plugin.ts) runs on Dart Sass's output, parsed by
//    PostCSS's default parser: the theme, the directives, responsive values,
//    token functions and the reference check. A `$variable` or namespaced
//    call Dart Sass kept as written (in a custom property, a plain-CSS
//    at-rule's prelude, the arguments of `expression()`, …) fails there as
//    UXD_SASS_CONTEXT, whose fix is `#{…}`. Nothing else in Sass's output
//    changes, except that each top-level comment whose text starts with
//    `# sourceMappingURL=` is removed, as PostCSS removes it when it writes
//    no map, so the CSS is the same in the three `sourceMap` modes. Text
//    Sass prints from a string (`string.unquote()`, `#{…}`) that is not CSS
//    fails, located like any other error: the parser rejects a `;` or a
//    brace, an unclosed comment or string, an unclosed bracket in a
//    declaration, and a colon outside parentheses and strings in the value
//    of a property that is not custom (`b: a:b` is "Missed semicolon"; a
//    `progid:` filter is read), and the plugin reads a `//` in such a value,
//    outside a string and a `url()`, as a `//` comment: UXD_SASS_CONTEXT,
//    with the message it gives on its own.
//
// Every position in Dart Sass's output that compile() reports (an error, a
// warning, a reference issue) is moved to the author's file, line and column
// through the Sass stage's map, the same on every PostCSS of the peer range. A
// parse error in CSS the plugin parses itself (the theme it generates, a
// `references.css` entry) keeps PostCSS's position in that CSS, under no
// author's file. A requested source map chains the stage's map with PostCSS's
// and names only the files the author wrote.

import fs from 'fs';
import path from 'path';
import postcss, { Plugin, Result, Warning } from 'postcss';
// Types only: source-map-js is loaded when a position or a map is needed.
import type { RawSourceMap, SourceMapConsumer as Consumer } from 'source-map-js';
import uxdslPlugin = require('./plugin');
import { compileSassStage } from './sass/compile-sass';
import type { SassStageNearMiss, SassStageResult } from './sass/compile-sass';
import { restoreDirectiveSpacing } from './sass/protect';
import { resolveTheme } from './default-theme';
import { discoverThemeAsync, removedOptionsIn } from './config';
import { DEFAULT_BREAKPOINTS } from './language';
import { formatReferenceIssues } from './reference-core';
import type { ReferenceIssue } from './reference-core';

export interface CompileInput {
  /** The entry file, absolute or relative to the working directory; Dart Sass
   * reads it. Mutually exclusive with `source`. */
  entry?: string;
  /** The entry's text, compiled as if it were the file `from`. */
  source?: string;
  /** The path `source` is compiled as, absolute or relative to the working
   * directory; the file need not exist. Relative `@use`, `@forward` and
   * `@import` resolve from its directory, positions and the source map name
   * it, it is listed first in `dependencies`, and its extension decides how
   * the text is read: `.scss`, `.sass` and `.css` as written, anything else as
   * `.uxdsl`. Without it, `source` is an anonymous `.uxdsl` file in the
   * working directory: relative loads resolve from there, positions print
   * `<css input>` with no `file`, and it is never a dependency. Ignored with
   * `entry`. */
  from?: string;
}

export interface CompileConfig {
  /** The theme override, the PostCSS plugin's `theme` option. Its
   * `breakpoints` family is the one source of thresholds. Omitted, the theme
   * file is discovered in `configRoot`, once per compilation; a theme file
   * may export an async function. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  theme?: Record<string, any>;
  /** Whether to discover the theme file when `theme` is omitted. Default
   * `true`; `false` compiles against the base theme. Ignored with `theme`. */
  discoverTheme?: boolean;
  /** The directory the theme file is discovered in. Default: the working
   * directory. Ignored with `theme`. */
  configRoot?: string;
  /** The plugin's `references` option. An `onWarning` callback receives each
   * issue at the author's file, line and column. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  references?: Record<string, any>;
  /** Where the CSS will be written: a source map's `sources` are relative to
   * its directory (to the working directory without it). */
  to?: string;
  /** Whether a source map carries the author's text. Default `true`. */
  sourcesContent?: boolean;
  /** `false` (no map, the default), `'inline'` (a data URI appended last) or
   * `'external'` (returned as `map`; the caller writes the file and the
   * annotation). Any other value is an error, never silently ignored. */
  sourceMap?: false | 'inline' | 'external';
  /** Passed to Dart Sass: the deprecation ids to silence, and whether to
   * silence the deprecations of dependencies loaded through load paths or
   * `pkg:`. Any other key, or a value of the wrong type, is an error. */
  sass?: { silenceDeprecations?: string[]; quietDeps?: boolean };
}

export interface CompileWarning {
  text: string;
  file?: string;
  line?: number;
  column?: number;
}

export interface CompileResult {
  /** Dart Sass's expanded output with UXDSL's constructs resolved and each
   * top-level comment whose text starts with `# sourceMappingURL=` removed.
   * The same in the three `sourceMap` modes, except that `'inline'` appends
   * one final `sourceMappingURL` comment. */
  css: string;
  /** With `sourceMap` `'inline'` or `'external'`: the map, as a JSON string. */
  map?: string;
  /** Every file Dart Sass loaded, absolute: the entry (or `from`) first, then
   * Sass's load order, each once, with no `sass:` module and no plain-CSS
   * `@import` target; then the discovered theme file and the local modules
   * it requires. */
  dependencies: string[];
  /** Dart Sass's warnings (`UXD_SASS_WARNING` in Sass's order), then the Sass
   * stage's (`UXD_FUNCTION_SHADOWED` at each definition, then
   * `UXD_MODULE_ISOLATION` by load order, line and column), then the
   * plugin's; each at the author's file, line and column when it has a
   * position. */
  warnings: CompileWarning[];
  /** Whether this compilation emitted the theme: its stylesheet, or a file it
   * loads, reached `@uxdsl theme;`. */
  themeEmitted: boolean;
}

/** How positions and the source map name an anonymous source. */
const ANONYMOUS = '<css input>';
/** The file name an anonymous source is compiled as, in the working directory; it never surfaces. */
const ANONYMOUS_FILE = '__uxdsl_css_input__.uxdsl';

/** An author's position: the file (undefined for an anonymous source), 1-based line and column, and the file's text when the map carries it. */
interface AuthorPosition {
  file?: string;
  line: number;
  column: number;
  source: string | null;
}

/** Maps a position in Dart Sass's output (1-based line and column) to the author's, or null where the stage's map has no mapping on that line. */
type Locate = (line: number, column?: number) => AuthorPosition | null;

/**
 * Compiles `input` through the four stages above. Input, `sourceMap` and
 * `sass` are checked before anything is read; a failure is thrown as the
 * stage that failed reports it, at the author's position, and carries
 * `warnings`: the warnings produced before it, as `CompileResult.warnings`
 * would list them (`[]` when there were none).
 */
export async function compile(input: CompileInput, config: CompileConfig = {}): Promise<CompileResult> {
  const warnings: CompileWarning[] = [];
  try {
    return await compileInto(warnings, input, config);
  } catch (error) {
    if (error && typeof error === 'object') (error as { warnings?: CompileWarning[] }).warnings = warnings;
    throw error;
  }
}

/** compile(), pushing each warning onto `warnings` as soon as it exists. */
async function compileInto(warnings: CompileWarning[], input: CompileInput, config: CompileConfig): Promise<CompileResult> {
  if (!input || (typeof input.entry !== 'string' && typeof input.source !== 'string')) {
    throw new Error('uxdsl: compile() requires either { entry } or { source }.');
  }
  if (input.entry !== undefined && input.source !== undefined) {
    throw new Error('uxdsl: compile() accepts either { entry } or { source }, not both.');
  }
  // Validated strictly rather than coerced: a typo ('External', true) fails
  // loudly instead of silently producing no map.
  const sourceMap = config.sourceMap ?? false;
  if (sourceMap !== false && sourceMap !== 'inline' && sourceMap !== 'external') {
    throw new Error(`uxdsl: invalid sourceMap option ${JSON.stringify(sourceMap)} — expected false, 'inline' or 'external'.`);
  }
  validateSassOption(config.sass);

  const entry = input.entry !== undefined ? path.resolve(input.entry) : undefined;
  if (entry !== undefined && !fs.existsSync(entry)) {
    throw new Error(`uxdsl: entry file not found: ${entry}`);
  }
  const anonymous = entry === undefined && input.from === undefined;
  const stageEntry = entry ?? (input.from !== undefined ? path.resolve(input.from) : path.join(process.cwd(), ANONYMOUS_FILE));
  const hidden = anonymous ? stageEntry : undefined;
  // The one theme of this compilation: the reserved names, the plugin and
  // `dependencies` all read it.
  const discovered = config.theme === undefined && config.discoverTheme !== false ? await discoverThemeAsync(config.configRoot ?? process.cwd()) : null;
  const theme = config.theme ?? discovered?.theme ?? {};

  let stage: SassStageResult;
  try {
    stage = compileSassStage(
      entry !== undefined ? { entry } : { entry: stageEntry, source: input.source as string },
      { reserved: reservedNames(theme), sourceMap: true, sass: config.sass }
    );
  } catch (error) {
    const reported = (error as { warnings?: CompileWarning[] } | null)?.warnings ?? [];
    warnings.push(...reported.map((warning) => (hidden ? hideInWarning(warning, hidden) : warning)));
    throw hidden ? hideInError(error, hidden) : error;
  }
  warnings.push(...stage.warnings.map((warning) => (hidden ? hideInWarning(warning, hidden) : warning)));

  const locate = locator(stage, hidden);
  // The stage's map, chained only when a map is requested; every position is
  // located through the stage's map either way.
  const prev = sourceMap !== false ? chainable(stage.map!) : undefined;
  const sourcesContent = config.sourcesContent !== false;
  let result: Result | undefined;
  // Keeps the Result the plugins warn on, for the warnings given before a failure.
  const capture: Plugin = { postcssPlugin: 'uxdsl/capture', Once(_root, helpers) { result = helpers.result; } };
  try {
    // PostCSS's default parser, which reads Dart Sass's output as CSS and
    // rejects the text Sass printed that is not CSS, as stage 4 above
    // describes. `from` is always given (undefined for an anonymous source),
    // so PostCSS never warns that it is missing.
    result = await postcss([
      capture,
      restoreDirectiveSpacing,
      uxdslPlugin({
        // A removed option is handed to the plugin, which reports it as
        // UXD_OPTION_REMOVED and ignores it.
        ...removedOptionsIn(config),
        theme,
        references: relocatingReferences(config.references, locate, stageEntry, hidden),
      }),
      dropAnnotations,
    ]).process(stage.css, {
      from: hidden ? undefined : stageEntry,
      to: config.to,
      map: prev ? { prev, inline: false, annotation: false, sourcesContent } : false,
    });
  } catch (error) {
    if (result) warnings.push(...result.warnings().map((warning) => relocateWarning(warning, locate, stageEntry, hidden)));
    throw relocateError(error, stage.css, locate, stageEntry, hidden);
  }

  let css = result.css;
  let map: string | undefined;
  if (prev) {
    map = finalMap(result, prev, stage, { to: config.to, sourcesContent, hidden });
    // 'inline' is self-contained, so it is finished here, appended last:
    // only the final sourceMappingURL comment in a file counts. 'external'
    // returns the map and leaves the annotation to the writer, the only side
    // that knows what the `.map` file is called.
    if (sourceMap === 'inline') {
      css = `${css}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,${Buffer.from(map, 'utf8').toString('base64')} */`;
    }
  }

  const dependencies = stage.loadedFiles.filter((file) => file !== hidden);
  for (const file of discovered?.dependencies ?? []) if (!dependencies.includes(file)) dependencies.push(file);

  warnings.push(...result.warnings().map((warning) => relocateWarning(warning, locate, stageEntry, hidden)));
  // A near-miss Sass evaluated failed in the plugin above; one in a declaration
  // Sass never evaluated reached no CSS, and fails here with the same error.
  if (stage.nearMisses.length > 0) throw await nearMissError(stage.nearMisses[0], theme, stageEntry, hidden);

  // The plugin's own message for this compilation (the last one, should a
  // caller's PostCSS setup ever run it twice).
  const themeMessage = [...result.messages].reverse().find((message) => message.type === 'uxdsl-theme' && message.plugin === 'uxdsl');
  const themeEmitted = Boolean(themeMessage && (themeMessage as { emitted?: unknown }).emitted);
  return { css, map, dependencies, warnings, themeEmitted };
}

/**
 * The plugin's error for a near-miss call protect rewrote in a declaration
 * Sass never evaluated: the plugin compiles the call alone as a declaration's
 * value (inside `calc()` when it was nested in another call, as the plugin
 * reads a nested call), and the error is moved to the author's declaration,
 * frame included.
 */
async function nearMissError(miss: SassStageNearMiss, theme: CompileConfig['theme'], entry: string, hidden: string | undefined): Promise<unknown> {
  const css = `.x{a:${miss.topLevel ? miss.call : `calc(${miss.call})`}}`;
  const at: AuthorPosition = { file: miss.file === hidden ? undefined : miss.file, line: miss.line, column: miss.column, source: miss.source };
  try {
    await postcss([uxdslPlugin({ theme })]).process(css, { from: hidden ? undefined : entry });
  } catch (error) {
    return relocateError(error, css, () => at, entry, hidden);
  }
  return new Error(`uxdsl: ${at.file ?? ANONYMOUS}:${at.line}:${at.column}: ${miss.call} is not a function CSS or UXDSL knows.`);
}

// --- options -----------------------------------------------------------------

/** `config.sass`: an object holding only `silenceDeprecations` (strings) and `quietDeps` (a boolean), or absent. */
function validateSassOption(sass: unknown): void {
  if (sass === undefined) return;
  if (sass === null || typeof sass !== 'object' || Array.isArray(sass)) {
    throw new Error('uxdsl: the sass option must be an object: { silenceDeprecations?: string[], quietDeps?: boolean }.');
  }
  for (const key of Object.keys(sass)) {
    if (key !== 'silenceDeprecations' && key !== 'quietDeps') {
      throw new Error(`uxdsl: unknown sass option "${key}"; compile() passes only silenceDeprecations and quietDeps to Dart Sass.`);
    }
  }
  const { silenceDeprecations, quietDeps } = sass as Record<string, unknown>;
  if (silenceDeprecations !== undefined && (!Array.isArray(silenceDeprecations) || silenceDeprecations.some((id) => typeof id !== 'string'))) {
    throw new Error('uxdsl: sass.silenceDeprecations must be an array of deprecation ids (strings).');
  }
  if (quietDeps !== undefined && typeof quietDeps !== 'boolean') {
    throw new Error('uxdsl: sass.quietDeps must be a boolean.');
  }
}

/**
 * The breakpoint names of the effective theme the plugin will compile with,
 * over the default breakpoints. They are the names, beside the token
 * functions and `tone`, that a project `@function` replaces with a warning.
 */
function reservedNames(theme: CompileConfig['theme']): string[] {
  const breakpoints = resolveTheme(theme).breakpoints;
  const own = breakpoints && typeof breakpoints === 'object' && !Array.isArray(breakpoints) ? breakpoints : {};
  return Object.keys({ ...DEFAULT_BREAKPOINTS, ...own });
}

// --- positions -----------------------------------------------------------------

/** A `Locate` over the stage's map, which has the author's columns, absolute paths as sources and the author's text. The consumer is built on first use. */
function locator(stage: SassStageResult, hidden: string | undefined): Locate {
  let consumer: Consumer | undefined;
  return (line, column) => {
    if (!stage.map || !(line >= 1)) return null;
    if (!consumer) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { SourceMapConsumer } = require('source-map-js') as typeof import('source-map-js');
      consumer = new SourceMapConsumer(stage.map);
    }
    // The nearest mapping at or before the position on its line: the start of
    // the declaration or at-rule Dart Sass mapped, or, for a value Sass copied,
    // where it was written.
    const at = consumer.originalPositionFor({ line, column: Math.max(0, (column || 1) - 1) });
    if (at.source == null || at.line == null || at.column == null) return null;
    return { file: at.source === hidden ? undefined : at.source, line: at.line, column: at.column + 1, source: consumer.sourceContentFor(at.source, true) };
  };
}

/**
 * `error.stack` with its first line rewritten to the error's current message,
 * and each frame PostCSS adds for the node an error was thrown at
 * (`at <input>:<line>:<column>`, a position in Dart Sass's output) moved to
 * the author's position, or removed where its line has no mapping.
 */
function restack(error: Error, locate: Locate, entry: string, hidden: string | undefined): void {
  const stack = error.stack || '';
  const start = stack.indexOf('\n    at ');
  const frames = start === -1 ? [] : stack.slice(start + 1).split('\n');
  const input = (name: string) => (hidden ? /^<input css [^>]*>$/.test(name) : name === entry);
  const moved = frames.flatMap((frame) => {
    const node = /^ {4}at (.+):(\d+):(\d+)$/.exec(frame);
    if (!node || !input(node[1])) return [frame];
    const at = locate(Number(node[2]), Number(node[3]));
    return at ? [`    at ${at.file ?? ANONYMOUS}:${at.line}:${at.column}`] : [];
  });
  error.stack = [`${error.name}: ${error.message}`, ...moved].join('\n');
}

/**
 * An error the plugin or PostCSS's parser threw, with each position in Dart
 * Sass's output (`stageCss`) moved to the author's. A CssSyntaxError in Dart
 * Sass's output keeps `input` (its position there), `reason`, `plugin` and
 * `cause`; its file, line, column and `source` become the author's, so
 * `showSourceCode()` frames the author's line, and with no mapping on its line
 * it names the entry, without a line, column or frame. A CssSyntaxError in CSS
 * the plugin parses itself (the theme it generates, a directive's generated
 * rules, a `references.css` entry) keeps PostCSS's file, line, column and
 * frame: a position in that CSS, never under an author's file. A
 * ReferenceIntegrityError's issues are relocated like the first. In every case
 * the stack frames PostCSS adds for the nodes of Dart Sass's output the error
 * was thrown inside are relocated too. Anything else is returned unchanged.
 */
function relocateError(error: unknown, stageCss: string, locate: Locate, entry: string, hidden: string | undefined): unknown {
  if (!error || typeof error !== 'object') return error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = error as any;
  if (e.name === 'CssSyntaxError' && e.input && typeof e.input.line === 'number' && typeof e.setMessage === 'function') {
    if (e.input.source === stageCss) {
      const at = locate(e.input.line, e.input.column);
      if (at) {
        e.file = at.file;
        e.line = at.line;
        e.column = at.column;
        // The start, not deleted: PostCSS frames a long line by its end column.
        e.endLine = at.line;
        e.endColumn = at.column;
        if (at.source !== null) e.source = at.source;
        else delete e.source;
      } else {
        e.file = hidden ? undefined : entry;
        delete e.line;
        delete e.column;
        delete e.endLine;
        delete e.endColumn;
        delete e.source;
      }
      if (e.file === undefined) delete e.file;
      e.setMessage();
    }
    restack(e, locate, entry, hidden);
    return e;
  }
  if (e.name === 'ReferenceIntegrityError' && Array.isArray(e.issues)) {
    for (const issue of e.issues as ReferenceIssue[]) relocateIssue(issue, locate, entry, hidden);
    e.message = formatReferenceIssues(e.issues);
    const located = (e.issues as ReferenceIssue[]).find((issue) => issue.source);
    if (located) {
      e.file = located.source;
      e.line = located.line;
      e.column = located.column;
    } else {
      delete e.file;
      delete e.line;
      delete e.column;
    }
    restack(e, locate, entry, hidden);
    return e;
  }
  return error;
}

/** A reference issue at the author's position, in place (in place keeps its non-enumerable hint and node). */
function relocateIssue(issue: ReferenceIssue, locate: Locate, entry: string, hidden: string | undefined): void {
  if (typeof issue.line !== 'number') return;
  const at = locate(issue.line, issue.column ?? 1);
  if (at) {
    issue.line = at.line;
    issue.column = at.column;
    if (at.file === undefined) delete issue.source;
    else issue.source = at.file;
    return;
  }
  if (hidden) delete issue.source;
  else issue.source = entry;
  delete issue.line;
  delete issue.column;
}

/** The `references` option with its `onWarning` callback receiving each issue at the author's position. */
function relocatingReferences(references: CompileConfig['references'], locate: Locate, entry: string, hidden: string | undefined): CompileConfig['references'] {
  if (!references || typeof references.onWarning !== 'function') return references;
  const onWarning = references.onWarning as (issue: ReferenceIssue) => void;
  return {
    ...references,
    onWarning: (issue: ReferenceIssue) => {
      relocateIssue(issue, locate, entry, hidden);
      onWarning(issue);
    },
  };
}

/** A plugin warning at the author's position: `{ text }` when it has none, the entry when its line has no mapping. */
function relocateWarning(warning: Warning, locate: Locate, entry: string, hidden: string | undefined): CompileWarning {
  if (typeof warning.line !== 'number') return { text: warning.text };
  const at = locate(warning.line, warning.column);
  if (!at) return hidden ? { text: warning.text } : { text: warning.text, file: entry };
  return at.file !== undefined
    ? { text: warning.text, file: at.file, line: at.line, column: at.column }
    : { text: warning.text, line: at.line, column: at.column };
}

// --- the anonymous source ---------------------------------------------------------

/** `text` with the anonymous source's file name, absolute or as Sass prints it, replaced by `<css input>`. */
function hide(text: string, hidden: string): string {
  return text.split(hidden).join(ANONYMOUS).split(path.basename(hidden)).join(ANONYMOUS);
}

function hideInError(error: unknown, hidden: string): unknown {
  if (!error || typeof error !== 'object') return error;
  const e = error as Record<string, unknown>;
  for (const key of ['message', 'stack', 'sassFrame']) {
    if (typeof e[key] === 'string') e[key] = hide(e[key] as string, hidden);
  }
  if (e.file === hidden) delete e.file;
  return error;
}

function hideInWarning(warning: CompileWarning, hidden: string): CompileWarning {
  const out: CompileWarning = { ...warning, text: hide(warning.text, hidden) };
  if (out.file === hidden) delete out.file;
  return out;
}

// --- the source map --------------------------------------------------------------------

/**
 * Removes each top-level comment whose text starts with `# sourceMappingURL=`,
 * as PostCSS does itself when it writes no map, so the CSS is the same in the
 * three `sourceMap` modes. A comment inside a rule stays, as PostCSS leaves it.
 */
const dropAnnotations: Plugin = {
  postcssPlugin: 'uxdsl/drop-annotations',
  Once(root) {
    for (let index = root.nodes.length - 1; index >= 0; index--) {
      const node = root.nodes[index];
      if (node.type === 'comment' && node.text.startsWith('# sourceMappingURL=')) root.removeChild(index);
    }
  },
};

/**
 * The stage's map as compile() hands it to PostCSS: a source that does not
 * start with `/` (a Windows path, `C:\…`) is written from `/` (`/C:/…`); a
 * POSIX path is unchanged. PostCSS keeps a prev map's source as written only
 * when it starts with `/` or is a URL, and joins any other onto the directory
 * between `to` and the entry. Written from `/`, a source also stays an
 * absolute path where PostCSS looks a position up, which a URL is not for an
 * input without `from`.
 */
function chainable(map: RawSourceMap): RawSourceMap {
  return { ...map, sources: map.sources.map((source) => (source.startsWith('/') ? source : `/${source.replace(/\\/g, '/')}`)) };
}

/**
 * The final map: PostCSS's, chained with the stage's map through `map.prev`
 * (`prev`, the stage's map as `chainable` writes it), keeping only the
 * mappings whose source is one of the stage's (the author's files) or
 * PostCSS's `<no source>` (a generated node). Every other mapping names
 * PostCSS's own input, Dart Sass's output, at its coordinates, and is dropped.
 * The author's files are named as PostCSS names a file, relative to `to`'s
 * directory (the working directory without `to`), URL-encoded; an anonymous
 * source is `<css input>`; `sourcesContent` is the author's text.
 */
function finalMap(result: Result, prev: RawSourceMap, stage: SassStageResult, opts: { to?: string; sourcesContent: boolean; hidden: string | undefined }): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { SourceMapConsumer, SourceMapGenerator } = require('source-map-js') as typeof import('source-map-js');
  const raw = result.map.toJSON();
  const stageConsumer = new SourceMapConsumer(stage.map!);
  // Each source as PostCSS kept it, with the author's file it names: both
  // consumers list a map's sources in the map's order.
  const authorFiles = new Map(new SourceMapConsumer(prev).sources.map((source, index) => [source, stageConsumer.sources[index]]));
  const base = opts.to ? path.dirname(path.resolve(opts.to)) : process.cwd();
  const urls = new Map<string, string>();
  const urlOf = (file: string): string => {
    let url = urls.get(file);
    if (url === undefined) {
      const relative = path.relative(base, file);
      url = file === opts.hidden
        ? ANONYMOUS
        : encodeURI(path.sep === '\\' ? relative.replace(/\\/g, '/') : relative).replace(/[#?]/g, encodeURIComponent);
      urls.set(file, url);
    }
    return url;
  };
  const used = new Set<string>();
  const out = new SourceMapGenerator(raw.file ? { file: raw.file } : undefined);
  new SourceMapConsumer(raw).eachMapping((mapping) => {
    if (mapping.source == null || mapping.originalLine == null || mapping.originalColumn == null) return;
    const generated = { line: mapping.generatedLine, column: mapping.generatedColumn };
    const original = { line: mapping.originalLine, column: mapping.originalColumn };
    if (mapping.source === '<no source>') {
      out.addMapping({ generated, original, source: '<no source>' });
      return;
    }
    const file = authorFiles.get(mapping.source);
    if (file === undefined) return;
    used.add(file);
    out.addMapping({ generated, original, source: urlOf(file), name: mapping.name || undefined });
  });
  if (opts.sourcesContent) {
    for (const file of used) {
      const text = stageConsumer.sourceContentFor(file, true);
      if (text != null) out.setSourceContent(urlOf(file), text);
    }
  }
  return out.toString();
}

// --- the build-level theme check ---------------------------------------------

/** What one compiled stylesheet of a build says about the theme. */
export interface ThemeEmission {
  /** The stylesheet as a warning names it: an entry's label, or a module's path relative to the project. */
  label: string;
  /** compile()'s `themeEmitted` for it. */
  themeEmitted: boolean;
  /** Whether its CSS references a --uxdsl__ token. */
  referencesTokens: boolean;
  /** Whether it may carry the theme: a CSS Module cannot (`:root` is not pure there). */
  canCarryTheme: boolean;
}

/** Whether compiled CSS references a theme token: a `var(--uxdsl__…)` outside comments. */
export function referencesThemeTokens(css: string): boolean {
  return /var\(\s*--uxdsl__/.test(String(css).replace(/\/\*[\s\S]*?\*\//g, ''));
}

/**
 * The UXD_THEME_MARKER warning for one whole build, or null: more than one
 * stylesheet emitting the theme (a marker in a partial is emitted by every
 * stylesheet that loads the partial), or none emitting it while one references
 * a token and one could carry the theme, which leaves that token defined
 * nowhere. `unit` is what the host compiles one of: a CLI entry or a bundler
 * module. `complete` is false when the host could not see every stylesheet's
 * result, and then "none" is never reported. Labels are named in the order
 * given.
 */
export function themeEmissionWarning(
  sheets: ThemeEmission[],
  unit: 'entry' | 'module',
  { complete = true }: { complete?: boolean } = {},
): { kind: 'many' | 'none'; text: string } | null {
  const units = unit === 'entry' ? 'entries' : 'modules';
  const emitting = sheets.filter((sheet) => sheet.themeEmitted).map((sheet) => sheet.label);
  if (emitting.length > 1) {
    return {
      kind: 'many',
      text: `UXD_THEME_MARKER: ${emitting.length} ${units} emit the theme (${emitting.join(', ')}): each reaches \`@uxdsl theme;\`, itself or through a file it loads. Keep the marker in the one global stylesheet that defines the tokens, not in a partial other stylesheets load.`,
    };
  }
  if (complete && emitting.length === 0 && sheets.some((sheet) => sheet.referencesTokens) && sheets.some((sheet) => sheet.canCarryTheme)) {
    return {
      kind: 'none',
      text: `UXD_THEME_MARKER: no ${unit} reaches \`@uxdsl theme;\`, so nothing this build writes defines the --uxdsl__ tokens its CSS references. Write \`@uxdsl theme;\` once, at the top level of the global stylesheet that defines them.`,
    };
  }
  return null;
}
