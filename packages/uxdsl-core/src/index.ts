/**
 * Core processing engine for UXDSL files.
 *
 * MIG-B6-18 (FEAT-008): this is the one shared `compile()` the CLI, and
 * later Vite/Webpack (MIG-B6-20), all use — the exact same pipeline
 * (`postcss-scss` syntax, `postcss-import` with a shared resolver,
 * `postcss-advanced-variables`, `postcss-uxdsl`) instead of three
 * independently-drifted compilers for the same language. The previous
 * version of this file stripped `//` comments and inlined `@import`s with
 * its own line-by-line string manipulation, which corrupted valid CSS
 * (`url(https://...)`, a `//` inside a block comment) without ever
 * erroring, and silently left a nonexistent import's `@import` line in the
 * output instead of failing. See docs/features/FEAT-008/MIG-B6-18-compile-compartido.md.
 */

import fs from 'fs';
import path from 'path';
import postcss, { Result, Warning } from 'postcss';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const postcssScss = require('postcss-scss');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const postcssImport = require('postcss-import');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const postcssAdvancedVariables = require('postcss-advanced-variables');
// MIG-B6-18 item 4: resolved only through the declared dependency — no
// monorepo-local-path guessing with a silently-swallowed catch. A dev
// checkout resolves this via the ordinary `node_modules/postcss-uxdsl`
// symlink `file:`/workspace linking already creates; nothing here should
// ever need to know it's running inside this monorepo.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const uxdslPlugin = require('postcss-uxdsl');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DEFAULT_BREAKPOINTS } = require('postcss-uxdsl/ds-runtime');

/** Accepts the same shapes `uxdsl-cli` already normalizes breakpoints
 * from: a plain `{ name: px }` map, `[name, px][]` pairs, or
 * `{ name, min|px }[]`. Kept here (not imported) because it's a pure,
 * ~15-line normalizer with no dependency of its own — duplicating it is
 * cheaper and safer than adding a cross-package import for it alone; the
 * CLI's own copy is being removed in favor of this one (see uxdsl.js's
 * `compileEntryToCss`, which now calls `compile()` instead). */
function normalizeBpMap(input: unknown): Record<string, number> {
  if (!input) return { ...DEFAULT_BREAKPOINTS };
  const map: Record<string, number> = {};
  if (Array.isArray(input)) {
    input.forEach((it: any) => {
      if (Array.isArray(it)) {
        map[String(it[0])] = Number(it[1]);
      } else if (it && typeof it === 'object') {
        const name = String(it.name || '').trim();
        const px = Number(it.min ?? it.px);
        if (name && !Number.isNaN(px)) map[name] = px;
      }
    });
    return map;
  }
  Object.keys(input as Record<string, unknown>).forEach((k) => {
    const v = (input as Record<string, unknown>)[k];
    if (typeof v === 'number' && !Number.isNaN(v)) map[k] = v;
  });
  return map;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const postcssImportDefaultResolveId = require('postcss-import/lib/resolve-id');

/** MIG-B6-18 item 1 (moved from `uxdsl-cli/bin/uxdsl.js`, the CLI's own
 * copy is removed once it calls `compile()` instead), item 5 fix folded
 * in: supports a `~package/file.uxdsl`-style bare specifier resolved
 * through Node's own module resolution (so a project can import a
 * `.uxdsl` file shipped inside an installed package), otherwise resolves
 * relative to `basedir`. Found while wiring this up: a `resolve` option
 * that returns *any* path — found or not — makes postcss-import load that
 * exact path unconditionally, surfacing a raw, unlocated `ENOENT` for a
 * missing import instead of postcss-import's own well-formed, located
 * "Failed to find '...' in [...]" message (which only fires from *its*
 * default resolver, verified empirically — this was already true of the
 * CLI's pre-existing resolver, not something this refactor introduced,
 * but it's exactly the missing-import contract this story requires: "an
 * error naming the importing file and line"). So the relative-path branch
 * now checks existence first, and only the `~` bare-specifier branch is
 * genuinely reported as unresolvable directly, falling back to
 * postcss-import's own default resolver — reused via its internal
 * `resolve-id` module rather than reimplemented — for every other case,
 * so a real miss gets its real error instead of a synthetic one. */
function createImportResolver(entry: string) {
  const entryDir = path.dirname(entry);
  return (id: string, basedir: string, importOptions: unknown, astNode: unknown) => {
    const request = id.startsWith('~') ? id.slice(1) : id;
    if (request.startsWith('.') || request.startsWith('/')) {
      const direct = path.resolve(basedir, request);
      if (fs.existsSync(direct)) return direct;
    } else {
      // Bare specifier — a package import (e.g.
      // `postcss-uxdsl/theme/default-colors.css`), `~`-prefixed or not.
      // Real node resolution, not existsSync(path.resolve(...)), since
      // it lives in node_modules, not relative to the importing file.
      try {
        return require.resolve(request, { paths: [basedir, entryDir, process.cwd()] });
      } catch (_) {
        // Fall through: let postcss-import's own resolver produce the error.
      }
    }
    return postcssImportDefaultResolveId(id, basedir, importOptions, astNode);
  };
}

/** A minimal, existence-checked resolve used only by the cycle pre-check
 * below — deliberately not the full `createImportResolver` (which falls
 * back to postcss-import's own resolver for a `~` specifier or a genuine
 * miss): a nonexistent or unresolvable import is simply not part of a
 * cycle, so this returns `undefined` for it instead of ever needing that
 * fallback (which requires postcss-import's own `importOptions`/`astNode`
 * context this pre-check doesn't have). */
function resolveForCycleCheck(id: string, basedir: string, entryDir: string): string | undefined {
  if (id.startsWith('~')) {
    try {
      return require.resolve(id.slice(1), { paths: [basedir, entryDir, process.cwd()] });
    } catch (_) {
      return undefined;
    }
  }
  const direct = path.resolve(basedir, id);
  return fs.existsSync(direct) ? direct : undefined;
}

/** MIG-B6-18 item 5: postcss-import does not reliably error on a real
 * import cycle — verified empirically: `a.uxdsl` importing `b.uxdsl`
 * importing `a.uxdsl` back compiles successfully, silently duplicating
 * `a`'s rules once instead of failing. FEAT-008's rule 1 ("no silent
 * output that doesn't match the input") requires an error here, so this
 * walks the same `.uxdsl` import graph the real compile is about to,
 * purely to detect a cycle before handing off to postcss-import for the
 * actual inlining. A nonexistent import is deliberately left alone here —
 * postcss-import's own error for that case already names the importing
 * file and the exact line (verified), so duplicating that check would
 * only risk giving a worse message.
 *
 * MIG-B6-20 (FEAT-008): also called for a `{ source, from }` compile, not
 * just `{ entry }` — the Vite plugin's optional Sass pre-pass and every
 * single Webpack loader compilation use that shape exclusively.
 * Discovered via the shared parity fixture: without this, a cycle
 * reached only through `{ source, from }` (never `{ entry }`) silently
 * duplicated content again, defeating this exact guard for one of the
 * two call shapes `compile()` accepts. */
function checkImportCycles(
  entry: string,
  entryDir: string,
  visited: Set<string> = new Set(),
  stack: string[] = [],
  // MIG-B6-20 (FEAT-008) item 5: the top-level node's own content, for a
  // `{ source, from }` call — `from` need not exist on disk at all (an
  // unsaved editor buffer, or Sass-preprocessed content upstream), so this
  // reads from the caller's in-memory string instead of `fs.readFileSync`
  // for exactly the first (outermost) call only. Every nested import found
  // from there is still a real file, resolved and read from disk exactly
  // as before — only the walk's own starting point can be virtual.
  initialSource?: string
): void {
  if (stack.includes(entry)) {
    const cycleStart = stack.indexOf(entry);
    const cycle = stack.slice(cycleStart).concat(entry).map((p) => path.relative(process.cwd(), p));
    throw new Error(`UXD_IMPORT_CYCLE: Circular import detected: ${cycle.join(' -> ')}`);
  }
  if (visited.has(entry)) return; // Already walked from here with no cycle found.
  visited.add(entry);
  stack.push(entry);

  let source: string;
  if (initialSource !== undefined) {
    source = initialSource;
  } else {
    try {
      source = fs.readFileSync(entry, 'utf8');
    } catch (_) {
      stack.pop();
      return; // Unreadable/missing — postcss-import reports this on the real pass.
    }
  }
  const root = postcssScss.parse(source, { from: entry });
  const importTargets: string[] = [];
  root.walkAtRules('import', (at: any) => {
    const raw = String(at.params || '').trim()
      .replace(/^url\((.*)\)$/i, '$1').trim()
      .replace(/^(['"])(.*)\1$/, '$2');
    if (raw.endsWith('.uxdsl')) importTargets.push(raw);
  });
  for (const rel of importTargets) {
    const dep = resolveForCycleCheck(rel, path.dirname(entry), entryDir);
    if (dep !== undefined) checkImportCycles(dep, entryDir, visited, stack);
  }
  stack.pop();
}

interface CompileInput {
  /** Absolute or cwd-relative path to the entry `.uxdsl` file. Mutually
   * exclusive with `source`. */
  entry?: string;
  /** In-memory UXDSL source. `@import`s inside it resolve relative to
   * `from` if provided (matching postcss's own `from` contract) — a
   * bare/`~`-prefixed specifier resolves the same way it would for
   * `entry`, and the same cycle pre-detection applies, both starting from
   * this in-memory content rather than reading `from` off disk (which
   * need not exist as a real file at all). */
  source?: string;
  /** Origin path for an in-memory `source`, for relative `@import`
   * resolution, bare/`~`-specifier resolution, cycle detection and
   * diagnostics location. Ignored when `entry` is given. */
  from?: string;
}

interface CompileConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  theme?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  references?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  breakpoints?: any;
  includeTheme?: boolean;
  to?: string;
  sourcesContent?: boolean;
  /** Declared, not yet implemented (MIG-B6-21) — `false` is the only
   * accepted value today. Any other value is a hard "not implemented"
   * error, never silently ignored, so a caller can tell "no sourcemap
   * support yet" apart from "sourcemap silently didn't happen". */
  sourceMap?: false | 'inline' | 'external';
}

interface CompileWarning {
  text: string;
  file?: string;
  line?: number;
  column?: number;
}

interface CompileResult {
  css: string;
  map?: string;
  /** Every file this compilation actually read, entry first, in a stable
   * order — from postcss-import's own `dependency` messages. */
  dependencies: string[];
  warnings: CompileWarning[];
}

/**
 * The one shared compilation pipeline: `postcss-scss` syntax (so native
 * SCSS-like nesting/comments parse correctly), `postcss-import` (with the
 * shared resolver) for `@import` inlining, `postcss-advanced-variables`
 * for `$var` resolution — *before* `postcss-uxdsl` ever sees the source,
 * so a `$var` holding a responsive expression expands the same way
 * MIG-B6-14 made the plugin-used-alone case work — and finally
 * `postcss-uxdsl` itself. Used identically by `processUxdsl()` below (the
 * CLI's compatibility entry point) and by `uxdsl-cli`'s own `build`/`watch`.
 */
async function compileImpl(input: CompileInput, config: CompileConfig = {}): Promise<CompileResult> {
  if (!input || (typeof input.entry !== 'string' && typeof input.source !== 'string')) {
    throw new Error('uxdsl-core: compile() requires either { entry } or { source }.');
  }
  if (input.entry !== undefined && input.source !== undefined) {
    throw new Error('uxdsl-core: compile() accepts either { entry } or { source }, not both.');
  }
  const sourceMap = config.sourceMap ?? false;
  if (sourceMap !== false) {
    throw new Error(`uxdsl-core: sourceMap option "${sourceMap}" is not implemented yet (see MIG-B6-21) — pass \`false\` (the default) instead of silently ignoring it.`);
  }

  const entry = input.entry !== undefined ? path.resolve(input.entry) : undefined;
  const from = entry ?? (input.from !== undefined ? path.resolve(input.from) : undefined);

  if (entry !== undefined && !fs.existsSync(entry)) {
    throw new Error(`uxdsl-core: entry file not found: ${entry}`);
  }
  const source = entry !== undefined ? fs.readFileSync(entry, 'utf8') : (input.source as string);
  // MIG-B6-20 (FEAT-008): both the import resolver (bare/`~` specifiers)
  // and cycle detection key off `from`, not just `entry` — a `{ source,
  // from }` call needs exactly the same guarantees an `{ entry }` call
  // gets, since the Vite plugin's Sass pre-pass and every Webpack loader
  // compilation only ever use this shape. `initialSource` supplies the
  // top-level node's own content for the cycle walk, since `from` need
  // not exist on disk at all in this shape.
  const resolveImport = from !== undefined ? createImportResolver(from) : undefined;
  if (from !== undefined) {
    checkImportCycles(from, path.dirname(from), undefined, undefined, entry === undefined ? source : undefined);
  }

  const includeTheme = config.includeTheme !== false;
  const plugins = [
    postcssImport(resolveImport ? { resolve: resolveImport } : {}),
    postcssAdvancedVariables(),
    uxdslPlugin({
      breakpoints: config.breakpoints,
      theme: config.theme,
      references: config.references,
      includeTheme,
    }),
  ];

  const result: Result = await postcss(plugins).process(source, {
    from,
    to: config.to,
    syntax: postcssScss,
    map: false,
  });

  // SCSS "//" line comments parse fine under postcss-scss but are not
  // valid CSS — a sass compiler drops them, it doesn't turn them into
  // `/* */` comments. Left alone, postcss-scss's stringifier would emit
  // them verbatim into the final stylesheet. Real block comments
  // (`/* ... */`, including ones that happen to contain a URL) are
  // untouched: only `raws.inline` (the "//" form) is stripped.
  result.root.walkComments((comment) => {
    if (comment.raws.inline) comment.remove();
  });

  // MIG-B6-18 item 1: the same breakpoint metadata `uxdsl-cli` used to
  // append only from its own build path (`/*@uxdsl-bp …*/` + a
  // `#uxdsl-bp-meta` marker rule, read back by the runtime to detect the
  // active breakpoint from the CSSOM) — moved here so every `compile()`
  // caller gets it, not just the CLI. Scoped to `includeTheme` for the
  // same reason the CLI scoped it: it's global-theme information that
  // belongs to the one entry defining the theme, not to every
  // component/CSS-Module entry compiled against it.
  let finalCss = result.root.toString(postcssScss);
  if (includeTheme) {
    const bpMap = normalizeBpMap(config.breakpoints);
    const bpJson = JSON.stringify(bpMap);
    finalCss = `${finalCss}\n/*@uxdsl-bp ${bpJson}*/\n#uxdsl-bp-meta { --bp: '${bpJson}'; display: none; }`;
  }

  const dependencies: string[] = [];
  if (entry !== undefined) dependencies.push(entry);
  for (const message of result.messages) {
    if (message.type === 'dependency' && typeof (message as any).file === 'string') {
      const file = (message as any).file as string;
      if (!dependencies.includes(file)) dependencies.push(file);
    }
  }

  const warnings: CompileWarning[] = result.warnings().map((w: Warning) => ({
    text: w.text,
    file: w.node?.source?.input.file,
    line: w.line,
    column: w.column,
  }));

  return { css: finalCss, dependencies, warnings };
}

/** Options accepted by the compatibility entry point. A superset of
 * `CompileConfig` — `fileId` is `processUxdsl`'s historical name for
 * `compile()`'s `entry`/`from`, kept so no existing caller (the CLI, this
 * package's own tests, any external consumer) has to change. */
interface CoreOptions extends CompileConfig {
  /** Absolute path of the file being processed. When set, enables
   * `@import` inlining and cycle detection, exactly like `compile()`'s
   * `entry`. When absent, `source` is compiled standalone (relative
   * `@import`s still resolve against `process.cwd()` via postcss-import's
   * own default). */
  fileId?: string;
}

/**
 * `processUxdsl(source, options)` — the callable default export's
 * historical contract (D3 of FEAT-007): a `Promise<string>` wrapper
 * around `compile()`, unchanged in signature or return type so every
 * existing caller keeps working untouched.
 */
async function processUxdsl(source: string, options: CoreOptions = {}): Promise<string> {
  const { fileId, ...config } = options;
  const input: CompileInput = fileId !== undefined ? { entry: fileId } : { source };
  const { css } = await compileImpl(input, config);
  return css;
}

// CommonJS export so consumers can do `require('uxdsl-core')` and call it
// directly, with `compile` reachable — and correctly *typed* — as a
// property on that same export: `module.exports = processUxdsl;
// module.exports.compile = compile;`. TS's supported way to add a typed
// property to a function value it also does `export =` on is a namespace
// declaration-merged with the function's name; `export const compile = …` inside
// it both types `processUxdsl.compile` for a TS consumer and compiles to
// the real `processUxdsl.compile = compile;` assignment a JS consumer needs.
// eslint-disable-next-line @typescript-eslint/no-namespace
namespace processUxdsl {
  export const compile = compileImpl;
}

export = processUxdsl;
