import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
// Types only: nothing in this module loads Dart Sass or source-map-js until a
// compilation runs (`require` inside the functions below).
import type * as Sass from 'sass';
import type { RawSourceMap } from 'source-map-js';
import type { CompileWarning } from '../compile';
import { diagnostic } from '../diagnostics';
import { findShadowingFunctions, protect } from './protect';
import type { ProtectCall, ProtectProblem, ProtectResult } from './protect';

// The Sass stage: one synchronous function that compiles an entry with Dart
// Sass (the pure-JavaScript `sass` package), so that a `.scss` project renamed
// to `.uxdsl` compiles to the CSS Dart Sass produces for it, with UXDSL's own
// syntax passed through for the plugin.
//
// - Resolution is Dart Sass's: `.uxdsl` is a third Sass extension beside
//   `.sass` and `.scss` (`_name` and `name`, `.import` variants for `@import`,
//   `dir/index`, `.css` only when no Sass file matches, more than one match is
//   Sass's ambiguity error). A URL with no scheme is resolved relative to the
//   importing file, then under each load path in order (by default every
//   `node_modules` from the entry's directory up) and each directory of
//   `SASS_PATH` after them, so a package can ship `.uxdsl` partials. Each is
//   searched as Dart Sass searches a load path: the URL is joined to it
//   unnormalized, so the filesystem walks a leading `..` from that directory
//   (one that does not exist finds nothing). `pkg:` URLs are Dart Sass's
//   `NodePackageImporter`'s, and so is a relative URL inside a package it
//   loaded, Sass's own extensions first: there a `.uxdsl` partial is found
//   only when no `.sass`, `.scss` or `.css` file (nor a directory index)
//   answers the URL, and one beside a `.scss` of the same name is not
//   reported as ambiguous. Canonical paths are normalized, have the on-disk
//   case on case-insensitive systems and keep symlinks, as Dart Sass's
//   filesystem importer does.
// - Files are read as Dart Sass reads them (UTF-8; a BOM is a character; text
//   that is not valid UTF-8 is Sass's `Invalid UTF-8.` at the first bad
//   character). A `.uxdsl` file goes through `protect()`; `.scss`, `.sass` and
//   `.css` are served as written.
// - A Sass failure is a `UXD_SASS` error at the author's file, line and column
//   (columns translated back through protect's map), with Sass's message, its
//   code frame and stack re-rendered with the author's text (`sassFrame`), and
//   the `sass.Exception` as `cause`. An I/O error is rethrown unchanged.
// - Every Sass warning is a `UXD_SASS_WARNING: …` warning, located like an
//   error; an `@warn` is located by its stack frame. Sass's own cap (five per
//   deprecation type, then a summary) applies; debug output is dropped.
// - With `sourceMap`, the map has the author's columns, absolute paths as
//   sources and the original text as sourcesContent.
// - A project `@function` named like a UXDSL function (a token function,
//   `tone`, a reserved breakpoint name) wins exactly where Dart Sass calls its
//   bare name. Sass decides visibility: a probe compile records, at each token
//   call written in a `.uxdsl` file, whether the bare name means a project
//   function there; a call Sass resolves to the project function is left as
//   written, any other keeps UXDSL's token, and a call seen both ways is
//   written as a choice Sass makes at each evaluation. A call Sass never
//   evaluates (a pseudo-class argument it keeps as raw text) keeps the token,
//   the text Sass leaves there. The probe reads visibility through
//   `sass:meta`, so a project function named `function-exists` or
//   `get-function` does not answer for it. Each definition some bare call
//   resolves to is one `UXD_FUNCTION_SHADOWED` warning at the definition. A
//   build with no such definition runs Dart Sass once.
// - Nothing is shared between calls: every cache lives in one call's state,
//   and every position is translated with the pass that produced it. Every
//   pass sees the text first read for each file the importer serves; a file
//   Dart Sass loads itself (`pkg:`) is read by Sass in each pass. The
//   `uxdsl-probe-` prefix is reserved for the probe: its functions, and the
//   namespace under which it reaches `sass:meta`.

export interface SassStageInput {
  /** Absolute path of the entry. With `source`, the text is compiled as if it were this file, which need not exist. */
  entry: string;
  /** In-memory text of the entry. */
  source?: string;
}

export interface SassStageOptions {
  /** The effective theme's breakpoint names. With the token functions and `tone`, the names a project `@function` is checked against (`UXD_FUNCTION_SHADOWED`). */
  reserved: Iterable<string>;
  /** true: Dart Sass runs with a source map and the result carries it, translated. false: no map. */
  sourceMap: boolean;
  /** Directories searched, in order, for a URL with no scheme that is not found relative to the importing file, each as Dart Sass searches a load path (a leading `..` in the URL is walked from the directory itself, so one that does not exist finds nothing); relative entries resolve against `process.cwd()`. Default: every `node_modules` from the entry's directory up to the root, nearest first. The directories of the `SASS_PATH` environment variable are searched after these, as Dart Sass searches them. */
  loadPaths?: string[];
  /** Passed to Dart Sass; only these two keys are read. */
  sass?: { silenceDeprecations?: string[]; quietDeps?: boolean };
}

export interface SassStageResult {
  /** Dart Sass's expanded output; never a `sourceMappingURL` comment. */
  css: string;
  /** Present when `options.sourceMap`: the author's columns, absolute paths as sources, the original text as sourcesContent. */
  map?: RawSourceMap;
  /** Absolute paths: the entry first (listed even when it exists only in memory), then each loaded file once in first-load order; no `sass:` module and no plain-CSS `@import` target. */
  loadedFiles: string[];
  /** Sass's warnings in Sass's order (`UXD_SASS_WARNING: [<id>] <first line>` or `UXD_SASS_WARNING: <first line>`), then one `UXD_FUNCTION_SHADOWED: …` per shadowing definition, located at the definition. */
  warnings: CompileWarning[];
}

/** Thrown for a Sass failure. An I/O error reading a file is rethrown unchanged instead; invalid input is a TypeError thrown before Sass runs. */
export interface SassStageError extends Error {
  code: 'UXD_SASS';
  /** Absolute; set when Sass's span names a file. */
  file?: string;
  /** 1-based. */
  line?: number;
  /** 1-based, the author's column. */
  column?: number;
  /** Sass's message, verbatim. */
  sassMessage: string;
  /** Sass's code frame and stack, showing the author's text; never colored. */
  sassFrame: string;
  /** The `sass.Exception`. */
  cause: unknown;
}

type Role = 'uxdsl' | 'scss' | 'sass' | 'css';
type Kind = 'file' | 'dir' | null;
type Decision = 'user' | 'token' | 'mixed';

const SYNTAX: Record<Role, Sass.Syntax> = { uxdsl: 'scss', scss: 'scss', sass: 'indented', css: 'css' };
const FOLDS_CASE = process.platform === 'darwin' || process.platform === 'win32';
/** The namespace under which the probe and the dispatch reach `sass:meta`, so a project function named `function-exists` or `get-function` never answers for it. */
const META_NAMESPACE = 'uxdsl-probe-meta';
const META_PREFIX = `@use "sass:meta" as ${META_NAMESPACE}; `;
/**
 * The column Sass's code frame draws before each code line of a frame that holds
 * multi-line spans: one character (a space, │, ┌, ┬, └, ┼ or ─) for each of the
 * most multi-line spans that share a line of the frame, then a space. Its width is
 * the same on every code line of the frame.
 */
const CONNECTOR = /^[ │┌┬└┼─]+ $/;

/** Text that is not valid UTF-8, located at its first replacement character, as Dart Sass reports it. */
class InvalidUtf8 extends Error {
  constructor(readonly file: string, readonly text: string, readonly offset: number) {
    super('Invalid UTF-8.');
  }
}

interface Files {
  kind(file: string): Kind;
  realCase(file: string): string;
}

/** One call's state: what every pass shares. */
interface Stage {
  sass: typeof Sass;
  reserved: string[];
  loadPaths: string[];
  entryPath: string;
  entryUrl: URL;
  sourceMap: boolean;
  silenceDeprecations: string[] | undefined;
  quietDeps: boolean | undefined;
  files: Files;
  /** Successful reads, so every pass sees the same text of each file the importer serves (Dart Sass reads a file it loads itself, through `pkg:`, in each pass). */
  texts: Map<string, string>;
  fileIds: Map<string, number>;
}

/** A file as one pass gave it to Sass. */
interface Served {
  original: string;
  /** Exactly what Sass received. */
  text: string;
  role: Role;
  protected: ProtectResult | null;
  /** Where on line 1 the `sass:meta` prefix was inserted, and its length (0 without one). */
  prefixAt: number;
  prefixLength: number;
}

interface Site {
  file: string;
  call: ProtectCall;
}

interface SassWarn {
  message: string;
  deprecationType?: Sass.Deprecation;
  span?: Sass.SourceSpan;
  stack?: string;
}

type Stash = { kind: 'io'; error: unknown } | { kind: 'utf8'; failure: InvalidUtf8 };

/** One Dart Sass compile and what it saw. */
interface Pass {
  served: Map<string, Served>;
  /** The token calls of the `.uxdsl` files served, by site id (file id and offset, stable across the passes of a call). */
  sites: Map<string, Site>;
  plainCalls: Site[];
  /** A read failure inside the importer, which Sass reports only as its own wrapper. */
  stash: Stash | null;
  warns: SassWarn[];
  result: Sass.CompileResult | null;
  failed: boolean;
  error: unknown;
}

interface PassHooks {
  /** Reports to the caller: the real logger and the map option. Otherwise Sass's silent logger and no map. */
  report: boolean;
  site?: (siteId: string, file: string, call: ProtectCall) => string | null | undefined;
  append?: (file: string, role: Role, served: { original: string; protected: ProtectResult | null; plainCalls: Site[] }) => string;
  /** Whether a `.uxdsl` or `.scss` file gets the `sass:meta` prefix; asked after its calls were decided and its lines appended. */
  prefix?: (file: string) => boolean;
  functions?: Record<string, Sass.CustomFunction<'sync'>>;
}

interface Definition extends ProtectProblem {
  file: string;
}

interface StackFrame {
  indent: string;
  pathText: string;
  file: string | null;
  line: number;
  column: number;
  member: string | undefined;
}

/** Compiles `input` with Dart Sass. Synchronous; loads Dart Sass when it runs. */
export function compileSassStage(input: SassStageInput, options: SassStageOptions): SassStageResult {
  validate(input, options);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sass: typeof Sass = require('sass');
  const stage = openStage(sass, input, options);
  const first = runPass(stage, { report: true });
  rethrowNonSass(stage, first);
  const { report, shadowing } = resolveShadowing(stage, first);
  return finish(stage, report, shadowing);
}

// --- input and per-call state ------------------------------------------------------

function validate(input: SassStageInput, options: SassStageOptions): void {
  if (!input || typeof input.entry !== 'string' || !path.isAbsolute(input.entry)) throw new TypeError('compileSassStage: input.entry must be an absolute path');
  if (input.source !== undefined && typeof input.source !== 'string') throw new TypeError('compileSassStage: input.source must be a string when given');
  const reserved = options ? (options as { reserved?: unknown }).reserved : undefined;
  if (reserved == null || typeof (reserved as Iterable<string>)[Symbol.iterator] !== 'function') throw new TypeError('compileSassStage: options.reserved must be an iterable of names');
  if (options.loadPaths !== undefined && (!Array.isArray(options.loadPaths) || options.loadPaths.some((entry) => typeof entry !== 'string'))) throw new TypeError('compileSassStage: options.loadPaths must be an array of paths');
}

function openStage(sass: typeof Sass, input: SassStageInput, options: SassStageOptions): Stage {
  const files = filesystem();
  const given = path.resolve(input.entry);
  const entryPath = files.kind(given) === 'file' ? files.realCase(given) : given;
  let text = input.source;
  if (text === undefined) {
    try {
      text = readLikeSass(entryPath);
    } catch (error) {
      if (error instanceof InvalidUtf8) throw utf8Error(error, null, null);
      throw error;
    }
  }
  const texts = new Map<string, string>([[entryPath, text]]);
  return {
    sass,
    reserved: Array.from(options.reserved),
    loadPaths: [...(options.loadPaths ? options.loadPaths.map((entry) => path.resolve(entry)) : nodeModulesChain(entryPath)), ...sassPathDirectories()],
    entryPath,
    entryUrl: pathToFileURL(entryPath),
    sourceMap: options.sourceMap === true,
    silenceDeprecations: options.sass ? options.sass.silenceDeprecations : undefined,
    quietDeps: options.sass ? options.sass.quietDeps : undefined,
    files,
    texts,
    fileIds: new Map(),
  };
}

/**
 * The directories of the `SASS_PATH` environment variable, which Dart Sass
 * reads on every compile and searches after the load paths: split on `;` on
 * win32 and `:` elsewhere, each resolved against the working directory (an
 * empty entry is the working directory itself). The importer searches them
 * itself, so a `.uxdsl` file there is found as a `.scss` file is.
 */
function sassPathDirectories(): string[] {
  const value = process.env.SASS_PATH;
  return value === undefined ? [] : value.split(process.platform === 'win32' ? ';' : ':').map((entry) => path.resolve(entry));
}

/** Every `node_modules` from the file's directory up to the root, nearest first. */
function nodeModulesChain(file: string): string[] {
  const out: string[] = [];
  let dir = path.dirname(file);
  for (;;) {
    out.push(path.join(dir, 'node_modules'));
    const up = path.dirname(dir);
    if (up === dir) return out;
    dir = up;
  }
}

function idOf(stage: Stage, file: string): number {
  let id = stage.fileIds.get(file);
  if (id === undefined) {
    id = stage.fileIds.size;
    stage.fileIds.set(file, id);
  }
  return id;
}

const roleOf = (file: string): Role => {
  const ext = path.extname(file);
  return ext === '.scss' ? 'scss' : ext === '.sass' ? 'sass' : ext === '.css' ? 'css' : 'uxdsl';
};

/** Reads `file` as Dart Sass does: UTF-8, a BOM kept as a character, and `Invalid UTF-8.` at the first replacement character (a literal U+FFFD included). */
function readLikeSass(file: string): string {
  const text = fs.readFileSync(file, 'utf8');
  const offset = text.indexOf('�');
  if (offset !== -1) throw new InvalidUtf8(file, text, offset);
  return text;
}

// --- resolution ---------------------------------------------------------------------

/** Stat and on-disk case, cached for one call. */
function filesystem(): Files {
  const kinds = new Map<string, Kind>();
  const cases = new Map<string, string>();
  const kind = (file: string): Kind => {
    let found = kinds.get(file);
    if (found === undefined) {
      try {
        const stats = fs.statSync(file, { throwIfNoEntry: false });
        found = stats ? (stats.isFile() ? 'file' : stats.isDirectory() ? 'dir' : null) : null;
      } catch {
        found = null;
      }
      kinds.set(file, found);
    }
    return found;
  };
  // Each component spelled as the directory lists it, symlink names kept: what
  // Dart Sass's filesystem importer canonicalizes to on darwin and win32.
  const realCase = (file: string): string => {
    if (!FOLDS_CASE) return file;
    const cached = cases.get(file);
    if (cached !== undefined) return cached;
    const dir = path.dirname(file);
    let result: string;
    if (dir === file) {
      result = process.platform === 'win32' ? file.charAt(0).toUpperCase() + file.slice(1) : file;
    } else {
      const realDir = realCase(dir);
      const base = path.basename(file);
      let name = base;
      try {
        const lower = base.toLowerCase();
        const matches = fs.readdirSync(realDir).filter((entry) => entry.toLowerCase() === lower);
        if (matches.length === 1) name = matches[0];
      } catch {
        // An unreadable directory keeps the spelling as written.
      }
      result = path.join(realDir, name);
    }
    cases.set(file, result);
    return result;
  };
  return { kind, realCase };
}

const filePath = (url: string | URL): string | null => {
  try {
    return fileURLToPath(url);
  } catch {
    return null;
  }
};

const resolveUrl = (url: string, base: URL): string | null => {
  try {
    return filePath(new URL(url, base));
  } catch {
    return null;
  }
};

/** `name` appended to `dir` as Dart Sass appends it: nothing is normalized, so a `..` is left for the filesystem to walk. */
const joinRaw = (dir: string, name: string): string => (dir.endsWith(path.sep) ? dir + name : dir + path.sep + name);

/**
 * Where Dart Sass looks for a URL with no scheme under `loadPath`: the URL's
 * decoded path joined to the load path without normalizing. Sass has already
 * removed every dot segment from the URL but its leading `..` segments, and the
 * filesystem walks those from the load path itself: under a load path that does
 * not exist nothing is found, and under a symlinked one `..` leads where the
 * link points.
 */
function underLoadPath(loadPath: string, url: string): string | null {
  const directory = loadPath.endsWith(path.sep) ? loadPath : loadPath + path.sep;
  const base = pathToFileURL(directory);
  const parents = (/^(?:\.\.(?:\/|$))*/.exec(url) as RegExpExecArray)[0];
  if (parents === '') return resolveUrl(url, base);
  // The rest has no dot segment left, so it resolves inside `directory`.
  const inside = resolveUrl(`./${url.slice(parents.length)}`, base);
  if (inside === null || !inside.startsWith(directory)) return null;
  return directory + parents.split('/').join(path.sep) + inside.slice(directory.length);
}

/**
 * The importer's canonicalize. A `file:` URL (the entry's relative loads, which
 * Sass resolves first) is resolved as that path; a URL with no scheme (as
 * written, from the `importers` role) relative to the importing file and then
 * under each load path, as Dart Sass searches a load path. The first base that
 * resolves wins; more than one candidate in one directory throws Sass's
 * ambiguity message. The file found is canonicalized as Sass does it:
 * normalized, with the on-disk case where the filesystem folds case.
 */
function canonicalize(stage: Stage, url: string, context: Sass.CanonicalizeContext): URL | null {
  const bases: string[] = [];
  if (url.startsWith('file:')) {
    const file = filePath(url);
    if (file === null) return null;
    bases.push(file);
  } else if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(url)) {
    return null;
  } else {
    const containing = context.containingUrl;
    if (containing && containing.protocol === 'file:') {
      const file = resolveUrl(url, containing);
      if (file !== null) bases.push(file);
    }
    for (const loadPath of stage.loadPaths) {
      const file = underLoadPath(loadPath, url);
      if (file !== null) bases.push(file);
    }
  }
  for (const base of bases) {
    const found = resolveImportPath(stage, base, context.fromImport);
    if (found !== null) return pathToFileURL(stage.files.realCase(path.resolve(found)));
  }
  return null;
}

/** Dart Sass's resolveImportPath with `.uxdsl` as a third Sass extension after `.sass` and `.scss`. */
function resolveImportPath(stage: Stage, base: string, fromImport: boolean): string | null {
  const ext = path.extname(base);
  if (ext === '.uxdsl' || ext === '.scss' || ext === '.sass' || ext === '.css') {
    const viaImport = fromImport ? exactlyOne(candidates(stage, `${base.slice(0, -ext.length)}.import${ext}`)) : null;
    return viaImport !== null ? viaImport : exactlyOne(candidates(stage, base));
  }
  const viaImport = fromImport ? exactlyOne(withExtensions(stage, `${base}.import`)) : null;
  if (viaImport !== null) return viaImport;
  const direct = exactlyOne(withExtensions(stage, base));
  if (direct !== null) return direct;
  if (stage.files.kind(base) !== 'dir') return null;
  const indexImport = fromImport ? exactlyOne(withExtensions(stage, joinRaw(base, 'index.import'))) : null;
  return indexImport !== null ? indexImport : exactlyOne(withExtensions(stage, joinRaw(base, 'index')));
}

/** The partial `_name` and then `name`, those that are files; each path is checked as written, as Dart Sass checks it. */
function candidates(stage: Stage, file: string): string[] {
  return [joinRaw(path.dirname(file), `_${path.basename(file)}`), file].filter((candidate) => stage.files.kind(candidate) === 'file');
}

function withExtensions(stage: Stage, base: string): string[] {
  const found = [...candidates(stage, `${base}.sass`), ...candidates(stage, `${base}.scss`), ...candidates(stage, `${base}.uxdsl`)];
  return found.length > 0 ? found : candidates(stage, `${base}.css`);
}

function exactlyOne(files: string[]): string | null {
  if (files.length === 0) return null;
  if (files.length === 1) return files[0];
  throw new Error(`It's not clear which file to import. Found:\n${files.map((file) => `  ${prettyPath(file)}`).join('\n')}`);
}

/** A path as Dart Sass prints it: normalized, and relative to the working directory unless that takes more segments than the absolute path. */
function prettyPath(file: string): string {
  const absolute = path.resolve(file);
  const relative = path.relative(process.cwd(), absolute) || '.';
  return segments(relative) > segments(absolute) ? absolute : relative;
}

const segments = (file: string): number => file.split(path.sep).filter((part, index) => part !== '' || index === 0).length;

// --- passes ----------------------------------------------------------------------------

function newPass(): Pass {
  return { served: new Map(), sites: new Map(), plainCalls: [], stash: null, warns: [], result: null, failed: false, error: undefined };
}

/** The text Sass receives for `file` in this pass, read once per call and protected once per pass. */
function serve(stage: Stage, pass: Pass, hooks: PassHooks, file: string): Served {
  const known = pass.served.get(file);
  if (known) return known;
  let original = stage.texts.get(file);
  if (original === undefined) {
    try {
      original = readLikeSass(file);
    } catch (error) {
      // Sass replaces whatever load() throws by its own wrapper; the original is kept here.
      pass.stash = error instanceof InvalidUtf8 ? { kind: 'utf8', failure: error } : { kind: 'io', error };
      throw error;
    }
    stage.texts.set(file, original);
  }
  const role = roleOf(file);
  let text = original;
  let protectedResult: ProtectResult | null = null;
  let prefixAt = 0;
  let prefixLength = 0;
  const filePlainCalls: Site[] = [];
  if (role === 'uxdsl') {
    const fileId = idOf(stage, file);
    protectedResult = protect(original, {
      reserved: stage.reserved,
      file,
      site: (call) => {
        const siteId = `${fileId}:${call.start}`;
        if (call.kind === 'plain') {
          const site = { file, call };
          pass.plainCalls.push(site);
          filePlainCalls.push(site);
        } else {
          pass.sites.set(siteId, { file, call });
        }
        return hooks.site ? hooks.site(siteId, file, call) : undefined;
      },
    });
    text = protectedResult.code;
  }
  if (hooks.append) text += hooks.append(file, role, { original, protected: protectedResult, plainCalls: filePlainCalls });
  if ((role === 'uxdsl' || role === 'scss') && hooks.prefix && hooks.prefix(file)) {
    // After a BOM, which must stay the first character.
    prefixAt = text.charCodeAt(0) === 0xfeff ? 1 : 0;
    text = text.slice(0, prefixAt) + META_PREFIX + text.slice(prefixAt);
    prefixLength = META_PREFIX.length;
  }
  const served: Served = { original, text, role, protected: protectedResult, prefixAt, prefixLength };
  pass.served.set(file, served);
  return served;
}

function runPass(stage: Stage, hooks: PassHooks): Pass {
  const { sass } = stage;
  const pass = newPass();
  const importer: Sass.Importer<'sync'> = {
    canonicalize: (url, context) => canonicalize(stage, url, context),
    load: (canonicalUrl) => {
      const served = serve(stage, pass, hooks, fileURLToPath(canonicalUrl));
      // Without sourceMapUrl, Sass names an importer's sources with data: URLs.
      return { contents: served.text, syntax: SYNTAX[served.role], sourceMapUrl: canonicalUrl };
    },
  };
  const entry = serve(stage, pass, hooks, stage.entryPath);
  const logger: Sass.Logger = hooks.report
    ? {
        warn: (message, options) => {
          pass.warns.push({ message, deprecationType: options.deprecation ? options.deprecationType : undefined, span: options.span, stack: options.stack });
        },
        debug: () => undefined,
      }
    : sass.Logger.silent;
  const map = hooks.report && stage.sourceMap;
  try {
    pass.result = sass.compileString(entry.text, {
      url: stage.entryUrl,
      syntax: SYNTAX[entry.role],
      importer,
      importers: [importer, new sass.NodePackageImporter(path.dirname(stage.entryPath))],
      style: 'expanded',
      sourceMap: map,
      sourceMapIncludeSources: map,
      alertColor: false,
      alertAscii: false,
      verbose: false,
      silenceDeprecations: stage.silenceDeprecations as Sass.Options<'sync'>['silenceDeprecations'],
      quietDeps: stage.quietDeps,
      logger,
      functions: hooks.functions || {},
    });
  } catch (error) {
    pass.failed = true;
    pass.error = error;
  }
  return pass;
}

/** The column in the author's text for a column Sass reports in what `pass` served (0-based both). */
function columnIn(pass: Pass, file: string, line0: number, column0: number): number {
  const served = pass.served.get(file);
  if (!served) return column0;
  let column = column0;
  if (line0 === 0 && served.prefixLength > 0 && column0 >= served.prefixAt) {
    column = column0 < served.prefixAt + served.prefixLength ? served.prefixAt : column0 - served.prefixLength;
  }
  return served.protected ? served.protected.toOriginalColumn(line0, column) : column;
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Stops on a failure Sass does not own: a read error (rethrown unchanged), invalid UTF-8 (UXD_SASS at the character), or an error that is not a sass.Exception. */
function rethrowNonSass(stage: Stage, pass: Pass): void {
  if (!pass.failed) return;
  const error = pass.error;
  const isSass = error instanceof stage.sass.Exception;
  if (pass.stash) {
    const sassMessage = isSass ? (error as Sass.Exception).sassMessage : '';
    if (pass.stash.kind === 'io') {
      if (!isSass || sassMessage.includes(messageOf(pass.stash.error))) throw pass.stash.error;
    } else if (!isSass || sassMessage.includes(pass.stash.failure.message)) {
      throw utf8Error(pass.stash.failure, isSass ? (error as Sass.Exception) : null, pass);
    }
  }
  if (!isSass) throw error;
}

function finish(stage: Stage, pass: Pass, shadowing: Definition[]): SassStageResult {
  rethrowNonSass(stage, pass);
  if (pass.failed) throw stageError(pass, pass.error as Sass.Exception);
  const result = pass.result as Sass.CompileResult;
  const loadedFiles = result.loadedUrls.filter((url) => url.protocol === 'file:').map((url) => fileURLToPath(url));
  const order = (file: string): number => {
    const index = loadedFiles.indexOf(file);
    return index === -1 ? loadedFiles.length : index;
  };
  const shadow = shadowing
    .slice()
    .sort((a, b) => order(a.file) - order(b.file) || a.line - b.line || a.column - b.column)
    .map((definition): CompileWarning => ({ text: definition.message, file: definition.file, line: definition.line, column: definition.column }));
  const out: SassStageResult = { css: result.css, loadedFiles, warnings: [...pass.warns.map((warn) => convertWarning(pass, warn)), ...shadow] };
  if (stage.sourceMap && result.sourceMap) out.map = translateMap(pass, result.sourceMap);
  return out;
}

// --- the author's SCSS wins ----------------------------------------------------------

/** The text of an indented-syntax file with its comments blanked: a line whose first non-blank characters are `/*` or `//` opens a comment that also covers the following lines indented deeper (blank lines included). Positions and line breaks are kept. */
function blankIndentedComments(text: string): string {
  const blank = (part: string): string => part.replace(/[^\r]/g, ' ');
  const lines = text.split('\n');
  let commentIndent = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const indent = line.length - line.replace(/^[ \t]+/, '').length;
    const body = line.slice(indent);
    if (commentIndent >= 0) {
      if (body.trim() === '' || indent > commentIndent) {
        lines[i] = blank(line);
        continue;
      }
      commentIndent = -1;
    }
    if (body.startsWith('/*') || body.startsWith('//')) {
      commentIndent = indent;
      lines[i] = line.slice(0, indent) + blank(body);
    }
  }
  return lines.join('\n');
}

/** A call written on one line, as the probe and the dispatch write it. */
const oneLine = (raw: string): string => raw.replace(/\r\n|\r|\n/g, ' ');

/** What the bare name means where this expression is evaluated: the function, or null when no function of that name is visible. Read through `sass:meta` under the reserved namespace (the file gets the prefix). */
const visibleFunction = (name: string): string => `if(sass(${META_NAMESPACE}.function-exists("${name}")): ${META_NAMESPACE}.get-function("${name}"); else: null)`;

const textOf = (value: Sass.Value): string => value.assertString().text;

/**
 * Finds the project functions named like UXDSL functions in every file the
 * build loaded and, when a `.uxdsl` file calls one of those names, lets Sass
 * decide each call: a probe compile records what the bare name means at every
 * evaluation of every candidate call, and a final compile (only when a
 * decision differs from the first pass) writes each call accordingly.
 */
function resolveShadowing(stage: Stage, first: Pass): { report: Pass; shadowing: Definition[] } {
  const { sass } = stage;
  const definitions: Definition[] = [];
  const scanned = new Set<string>();
  const scanText = (file: string, role: Role, text: string, protectedResult: ProtectResult | null): void => {
    if (scanned.has(file)) return;
    scanned.add(file);
    let problems: ProtectProblem[] = [];
    if (role === 'uxdsl') problems = protectedResult ? protectedResult.problems : protect(text, { reserved: stage.reserved, file }).problems;
    else if (role === 'scss') problems = findShadowingFunctions(text, { reserved: stage.reserved, file });
    else if (role === 'sass') problems = findShadowingFunctions(blankIndentedComments(text), { reserved: stage.reserved, file });
    for (const problem of problems) definitions.push({ ...problem, file });
  };
  // Every file of the pass: those the importer served, and those Sass loaded itself (pkg:).
  const scanPass = (pass: Pass): void => {
    for (const [file, served] of pass.served) scanText(file, served.role, served.original, served.protected);
    if (!pass.result) return;
    for (const url of pass.result.loadedUrls) {
      if (url.protocol !== 'file:') continue;
      const file = fileURLToPath(url);
      if (scanned.has(file)) continue;
      let text = stage.texts.get(file);
      if (text === undefined) {
        try {
          text = readLikeSass(file);
        } catch (error) {
          if (error instanceof InvalidUtf8) throw utf8Error(error, null, null);
          throw error;
        }
        stage.texts.set(file, text);
      }
      scanText(file, roleOf(file), text, null);
    }
  };

  scanPass(first);
  let names = new Set(definitions.map((definition) => definition.name));
  if (names.size === 0) return { report: first, shadowing: [] };
  const callsAName = (pass: Pass): boolean => [...pass.sites.values(), ...pass.plainCalls].some((site) => names.has(site.call.name));
  if (!first.failed && !callsAName(first)) return { report: first, shadowing: [] };

  // Which names are Sass's own global functions (color, and min/max/round/abs if a breakpoint is so named).
  const builtins = new Map<string, Sass.SassFunction>();
  const builtinsChecked = new Set<string>();
  const captureBuiltins = (): void => {
    const pending = [...names].filter((name) => !builtinsChecked.has(name));
    if (pending.length === 0) return;
    for (const name of pending) builtinsChecked.add(name);
    sass.compileString(['@use "sass:meta";', ...pending.map((name) => `$_: uxdsl-probe-builtin("${name}", if(sass(meta.function-exists("${name}")): meta.get-function("${name}"); else: null));`)].join('\n'), {
      logger: sass.Logger.silent,
      functions: {
        'uxdsl-probe-builtin($name, $f)': (args) => {
          if (args[1] instanceof sass.SassFunction) builtins.set(textOf(args[0]), args[1]);
          return sass.sassNull;
        },
      },
    });
  };
  const userFunction = (name: string, value: Sass.Value): Sass.SassFunction | null => {
    if (!(value instanceof sass.SassFunction)) return null;
    const builtin = builtins.get(name);
    return builtin && value.equals(builtin) ? null : value;
  };

  // Whether Sass can parse each candidate call as written (palette(primary.main) cannot): batched, the failing line dropped until the rest parses.
  const parses = new Map<string, boolean>();
  const checkParses = (raws: string[]): void => {
    let todo: string[] = [];
    for (const raw of new Set(raws)) {
      const line = oneLine(raw);
      if (parses.has(line)) continue;
      // A line comment inside a call that spans lines would swallow the rest of the one-line form.
      if (line !== raw && line.includes('//')) parses.set(line, false);
      else if (!todo.includes(line)) todo.push(line);
    }
    while (todo.length > 0) {
      try {
        sass.compileString(todo.map((line) => `$_: if(sass(false): ${line}; else: null);`).join('\n'), { logger: sass.Logger.silent });
        for (const line of todo) parses.set(line, true);
        todo = [];
      } catch (error) {
        const at = error instanceof sass.Exception && error.span ? error.span.start.line : -1;
        if (at < 0 || at >= todo.length) {
          for (const line of todo) parses.set(line, false);
          todo = [];
        } else {
          parses.set(todo[at], false);
          todo = todo.filter((_, index) => index !== at);
        }
      }
    }
  };
  const candidateRaws = (pass: Pass): string[] => [...pass.sites.values()].filter((site) => names.has(site.call.name)).map((site) => site.call.raw);
  const parseable = (call: ProtectCall): boolean => parses.get(oneLine(call.raw)) === true;

  checkParses(candidateRaws(first));
  captureBuiltins();

  // The probe: Sass's silent logger, no map. Each parseable candidate call becomes a choice whose
  // condition records what the bare name means there and whose value is what the final pass emits,
  // so the probe evaluates exactly what the build will. Lines appended at the end of files record a
  // name's meaning where protect never rewrites its calls, and capture each definition for attribution.
  // A file that holds any of them gets the `sass:meta` prefix its lookups use.
  let records = new Map<string, Array<{ fn: Sass.SassFunction | null }>>();
  let atEnd: Array<{ fileId: string; name: string; fn: Sass.SassFunction | null }> = [];
  let captures: Array<{ fileId: string; name: string; fn: Sass.SassFunction | null }> = [];
  // Calls Sass reads as raw text and never evaluates, where the probe's choice does not parse (a
  // pseudo-class argument in a selector, which Sass ends at the first ";"): they keep the token,
  // which is the text Sass leaves there.
  const unevaluated = new Set<string>();
  /** The probed call whose choice Sass could not parse: the probe failed inside its text before evaluating it. */
  const unparsedSite = (pass: Pass, written: Map<string, string>): string | null => {
    const error = pass.error;
    if (!(error instanceof sass.Exception) || !error.span || !error.span.url || error.span.url.protocol !== 'file:') return null;
    const served = pass.served.get(fileURLToPath(error.span.url));
    if (!served) return null;
    const offset = error.span.start.offset;
    for (const [siteId, text] of written) {
      if (records.has(siteId)) continue;
      const at = served.text.indexOf(text);
      if (at !== -1 && offset >= at && offset < at + text.length) return siteId;
    }
    return null;
  };
  let probe = first;
  for (let round = 1; ; round++) {
    if (round > parses.size + scanned.size + unevaluated.size + 2) throw new Error('uxdsl: the Sass stage\'s probe did not settle (an internal error)');
    records = new Map();
    atEnd = [];
    captures = [];
    const written = new Map<string, string>();
    const withLookups = new Set<string>();
    const namesBefore = new Set(names);
    probe = runPass(stage, {
      report: false,
      site: (siteId, file, call) => {
        if (call.kind !== 'token' || !names.has(call.name)) return undefined;
        if (unevaluated.has(siteId) || !parseable(call)) return call.protectedText;
        const text = `uxdsl-probe-pick(if(sass(uxdsl-probe-site("${siteId}", "${call.name}", ${visibleFunction(call.name)})): ${oneLine(call.raw)}; else: ${call.protectedText}))`;
        written.set(siteId, text);
        withLookups.add(file);
        return text;
      },
      append: (file, role, served) => {
        const fileId = idOf(stage, file);
        const lines: string[] = [];
        if (role === 'uxdsl') {
          for (const name of new Set(served.plainCalls.map((site) => site.call.name))) {
            if (names.has(name)) lines.push(`@debug uxdsl-probe-eof("${fileId}", "${name}", ${visibleFunction(name)});`);
          }
        }
        if (role === 'uxdsl' || role === 'scss') {
          const defined = role === 'uxdsl' && served.protected ? served.protected.problems : findShadowingFunctions(served.original, { reserved: stage.reserved, file });
          for (const name of new Set(defined.map((problem) => problem.name))) lines.push(`@debug uxdsl-probe-cap("${fileId}", "${name}", ${visibleFunction(name)});`);
        }
        if (lines.length === 0) return '';
        withLookups.add(file);
        return `\n${lines.join('\n')}\n`;
      },
      prefix: (file) => withLookups.has(file),
      functions: {
        'uxdsl-probe-site($id, $name, $f)': (args) => {
          const fn = userFunction(textOf(args[1]), args[2]);
          const id = textOf(args[0]);
          const list = records.get(id);
          if (list) list.push({ fn });
          else records.set(id, [{ fn }]);
          return fn ? sass.sassTrue : sass.sassFalse;
        },
        'uxdsl-probe-pick($value)': (args) => args[0],
        'uxdsl-probe-eof($file, $name, $f)': (args) => {
          atEnd.push({ fileId: textOf(args[0]), name: textOf(args[1]), fn: userFunction(textOf(args[1]), args[2]) });
          return sass.sassNull;
        },
        'uxdsl-probe-cap($file, $name, $f)': (args) => {
          captures.push({ fileId: textOf(args[0]), name: textOf(args[1]), fn: args[2] instanceof sass.SassFunction ? args[2] : null });
          return sass.sassNull;
        },
      },
    });
    scanPass(probe);
    names = new Set(definitions.map((definition) => definition.name));
    checkParses(candidateRaws(probe));
    captureBuiltins();
    const grew = [...names].some((name) => !namesBefore.has(name));
    const unprobed = [...probe.sites].some(([siteId, site]) => names.has(site.call.name) && parseable(site.call) && !unevaluated.has(siteId) && !written.has(siteId));
    const unparsed = probe.failed ? unparsedSite(probe, written) : null;
    if (unparsed !== null) unevaluated.add(unparsed);
    if (!grew && !unprobed && unparsed === null) break;
  }

  const decisions = new Map<string, Decision>();
  for (const [siteId, site] of probe.sites) {
    if (!names.has(site.call.name)) continue;
    const found = parseable(site.call) ? records.get(siteId) || [] : [];
    const user = found.some((record) => record.fn !== null);
    const token = found.some((record) => record.fn === null);
    decisions.set(siteId, user && token ? 'mixed' : user ? 'user' : 'token');
  }

  // The first pass stands when it emitted what every decision says.
  let reuse = !probe.failed || first.failed;
  for (const file of probe.served.keys()) if (!first.served.has(file)) reuse = false;
  for (const [siteId, decision] of decisions) {
    const earlier = first.sites.get(siteId);
    if (decision === 'mixed' || !earlier || (decision === 'user') !== (earlier.call.defaultProtected === false)) reuse = false;
  }
  let report = first;
  if (!reuse) {
    const mixedFiles = new Set<string>();
    for (const [siteId, decision] of decisions) if (decision === 'mixed') mixedFiles.add((probe.sites.get(siteId) as Site).file);
    const dispatch = (call: ProtectCall): string => {
      const name = call.name;
      const visible = builtins.has(name) ? `uxdsl-probe-user("${name}", ${visibleFunction(name)})` : `${META_NAMESPACE}.function-exists("${name}")`;
      return `uxdsl-probe-pick(if(sass(${visible}): ${oneLine(call.raw)}; else: ${call.protectedText}))`;
    };
    report = runPass(stage, {
      report: true,
      prefix: (file) => mixedFiles.has(file),
      site: (siteId, _file, call) => {
        const decision = call.kind === 'token' ? decisions.get(siteId) : undefined;
        if (decision === undefined) return undefined;
        if (decision === 'user') return null;
        if (decision === 'token') return call.protectedText;
        return dispatch(call);
      },
      functions: {
        'uxdsl-probe-pick($value)': (args) => args[0],
        'uxdsl-probe-user($name, $f)': (args) => (userFunction(textOf(args[0]), args[1]) ? sass.sassTrue : sass.sassFalse),
      },
    });
  }
  // The probe evaluates what the build emits: a probe that fails where the build does not is a bug here.
  if (probe.failed && !report.failed) throw new Error(`uxdsl: the Sass stage's probe failed where the build did not (an internal error): ${messageOf(probe.error)}`);

  // One warning per definition that some evaluated bare call written in a .uxdsl file resolves to,
  // attributed through the function each defining file captured at its end.
  const captureOf = (definition: Definition): Sass.SassFunction | null => {
    const fileId = String(idOf(stage, definition.file));
    const found = captures.find((capture) => capture.fileId === fileId && capture.name === definition.name && capture.fn !== null);
    return found ? found.fn : null;
  };
  const attributed = (fn: Sass.SassFunction, definition: Definition): boolean => {
    const own = captureOf(definition);
    if (own) return fn.equals(own);
    return !definitions.some((other) => {
      if (other === definition || other.name !== definition.name) return false;
      const theirs = captureOf(other);
      return theirs !== null && fn.equals(theirs);
    });
  };
  const shadowing = definitions.filter((definition) => {
    for (const [siteId, decision] of decisions) {
      if (decision === 'token') continue;
      const site = probe.sites.get(siteId);
      if (!site || site.call.name !== definition.name) continue;
      if ((records.get(siteId) || []).some((record) => record.fn !== null && attributed(record.fn, definition))) return true;
    }
    return atEnd.some((record) => record.name === definition.name && record.fn !== null && attributed(record.fn, definition));
  });
  return { report, shadowing };
}

// --- errors ---------------------------------------------------------------------------------

function relocate(error: Error, message: string): void {
  const stack = error.stack || '';
  const at = stack.indexOf('\n    at ');
  error.message = message;
  error.stack = `${error.name}: ${message}${at === -1 ? '' : stack.slice(at)}`;
}

/** A sass.Exception of `pass` as UXD_SASS at the author's position. */
function stageError(pass: Pass, exception: Sass.Exception): SassStageError {
  const sassMessage = exception.sassMessage;
  const error = diagnostic(`UXD_SASS: ${sassMessage}`) as SassStageError;
  const span = exception.span;
  const url = span ? span.url : undefined;
  if (span && url && url.protocol === 'file:') {
    const file = fileURLToPath(url);
    const line = span.start.line + 1;
    const column = columnIn(pass, file, span.start.line, span.start.column) + 1;
    relocate(error, `${file}:${line}:${column}: UXD_SASS: ${sassMessage}`);
    error.file = file;
    error.line = line;
    error.column = column;
  }
  error.code = 'UXD_SASS';
  error.sassMessage = sassMessage;
  error.sassFrame = renderFrame(pass, exception);
  error.cause = exception;
  return error;
}

/** Text that is not valid UTF-8 as UXD_SASS at its first bad character, with a frame and stack as Dart Sass draws them. */
function utf8Error(failure: InvalidUtf8, wrapper: Sass.Exception | null, pass: Pass | null): SassStageError {
  const { file, text, offset } = failure;
  let line0 = 0;
  let lineStart = 0;
  for (let i = 0; i < offset; i++) {
    const c = text.charCodeAt(i);
    if (c === 10 || (c === 13 && text.charCodeAt(i + 1) !== 10)) {
      line0++;
      lineStart = i + 1;
    }
  }
  let lineEnd = lineStart;
  while (lineEnd < text.length && text[lineEnd] !== '\n' && !(text[lineEnd] === '\r' && text[lineEnd + 1] !== '\n')) lineEnd++;
  const lineText = text.slice(lineStart, lineEnd);
  const column0 = offset - lineStart;
  const gutter = String(line0 + 1);
  const pad = ' '.repeat(gutter.length + 1);
  const frames: StackFrame[] = [{ indent: '  ', pathText: prettyPath(file), file, line: line0 + 1, column: column0 + 1, member: wrapper ? importMember(wrapper) : 'root stylesheet' }];
  if (wrapper && pass) {
    for (const line of wrapper.sassStack.split('\n')) {
      const frame = line ? parseStackLine(pass, line) : null;
      if (!frame) continue;
      if (frame.file) frame.column = columnIn(pass, frame.file, frame.line - 1, frame.column - 1) + 1;
      frames.push({ ...frame, indent: '  ' });
    }
  }
  const box = [`${pad}╷`, `${gutter} │ ${expandTabs(lineText)}`, `${pad}│ ${' '.repeat(displayWidth(lineText, column0))}^`, `${pad}╵`];
  const error = diagnostic('UXD_SASS: Invalid UTF-8.') as SassStageError;
  relocate(error, `${file}:${line0 + 1}:${column0 + 1}: UXD_SASS: Invalid UTF-8.`);
  error.code = 'UXD_SASS';
  error.file = file;
  error.line = line0 + 1;
  error.column = column0 + 1;
  error.sassMessage = 'Invalid UTF-8.';
  error.sassFrame = [...box, ...alignFrames(frames)].join('\n');
  error.cause = wrapper || failure;
  return error;
}

/** The stack member Dart Sass names for the rule that loaded a file: what the wrapper's span shows. */
function importMember(wrapper: Sass.Exception): string {
  const text = wrapper.span ? wrapper.span.text : '';
  if (text.startsWith('@use')) return '@use';
  if (text.startsWith('@forward')) return '@forward';
  if (text.startsWith('@include')) return 'load-css()';
  return '@import';
}

const expandTabs = (text: string): string => text.replace(/\t/g, '    ');

/** Display columns of `text`'s first `count` characters, a tab counting four as in Sass's code frame. */
function displayWidth(text: string, count: number): number {
  let width = 0;
  for (let i = 0; i < Math.min(count, text.length); i++) width += text[i] === '\t' ? 4 : 1;
  return width + Math.max(0, count - text.length);
}

/** The character index at display column `display` of `text`. */
function characterAt(text: string, display: number): number {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    if (width >= display) return i;
    width += text[i] === '\t' ? 4 : 1;
  }
  return text.length + Math.max(0, display - width);
}

interface CodeLine {
  file: string;
  line0: number;
  connector: string;
  served: string;
  original: string;
}

/**
 * Sass's code frame and stack for `exception` (its message without the leading
 * sassMessage), with every line Sass showed from what `pass` served replaced by
 * the author's line, the markers under it moved to the author's columns, and
 * the stack's columns translated. Every other line is Sass's own.
 */
function renderFrame(pass: Pass, exception: Sass.Exception): string {
  const message = exception.message;
  const frame = message.startsWith(`${exception.sassMessage}\n`) ? message.slice(exception.sassMessage.length + 1) : message;
  const url = exception.span ? exception.span.url : undefined;
  let region = url && url.protocol === 'file:' ? fileURLToPath(url) : null;
  let last: CodeLine | null = null;
  const out: string[] = [];
  for (const line of frame.split('\n')) {
    const header = /^\s*┌──> (.*)$/.exec(line);
    if (header) {
      region = path.resolve(process.cwd(), header[1]);
      last = null;
      out.push(line);
      continue;
    }
    // A shown line keeps a trailing carriage return (a CRLF file), which `.` would not match.
    const code = /^( *\d+ *)│ ([\s\S]*)$/.exec(line);
    if (code) {
      last = codeLine(pass, region, Number(code[1].trim()) - 1, code[2]);
      out.push(last && last.served !== last.original ? `${code[1]}│ ${last.connector}${expandTabs(last.original)}` : line);
      continue;
    }
    const marker = /^( *)│ ([\s\S]*)$/.exec(line);
    if (marker) {
      out.push(last && last.served !== last.original ? redrawMarker(pass, last, marker[1], marker[2]) || line : line);
      continue;
    }
    last = null;
    out.push(line);
  }
  return restack(pass, out).join('\n');
}

/** The served line Sass showed (after the frame's multi-line connector column, when it has one), or null when the shown text is not that line. */
function codeLine(pass: Pass, region: string | null, line0: number, shown: string): CodeLine | null {
  const served = region ? pass.served.get(region) : undefined;
  if (!served || !served.protected || !region) return null;
  const servedLine = served.text.split('\n')[line0];
  const originalLine = served.original.split('\n')[line0];
  if (servedLine === undefined || originalLine === undefined) return null;
  const expanded = expandTabs(servedLine);
  const width = shown.length - expanded.length;
  if (width < 0 || shown.slice(width) !== expanded) return null;
  const connector = shown.slice(0, width);
  if (connector !== '' && !CONNECTOR.test(connector)) return null;
  return { file: region, line0, connector, served: servedLine, original: originalLine };
}

/** The author's character index for a display column of the served line. */
const authorCharacter = (pass: Pass, code: CodeLine, servedDisplay: number): number => columnIn(pass, code.file, code.line0, characterAt(code.served, servedDisplay));

/** A marker line under a re-rendered code line, at the author's columns; null when it is not a marker. */
function redrawMarker(pass: Pass, code: CodeLine, gutter: string, body: string): string | null {
  const width = code.connector.length;
  // Where a multi-line span starts or ends inside a line, the connector column (one character per
  // span, ┌ or └ at this span's) is followed by dashes and a ^. Sass draws one dash more than the
  // display column of the span's first character, or as many as the display column after its last.
  const spans = Math.max(0, width - 1);
  const area = body.slice(0, spans);
  const edge = /[┌└]/.test(area) ? /^(─+)\^([\s\S]*)$/.exec(body.slice(spans)) : null;
  if (edge) {
    const dashes = edge[1].length;
    const drawn = area.includes('┌')
      ? 1 + displayWidth(code.original, authorCharacter(pass, code, dashes - 1))
      : Math.max(1, displayWidth(code.original, authorCharacter(pass, code, dashes)));
    return `${gutter}│ ${area}${'─'.repeat(drawn)}^${edge[2]}`;
  }
  const lead = body.slice(0, width);
  const single = /^( *)([\^━]+)([\s\S]*)$/.exec(body.slice(width));
  if (!single) return null;
  // A position inside a rewrite maps to the rewrite's start, so the marker keeps at least one character.
  const startCharacter = authorCharacter(pass, code, single[1].length);
  const endCharacter = Math.max(startCharacter + 1, authorCharacter(pass, code, single[1].length + single[2].length));
  const start = displayWidth(code.original, startCharacter);
  const length = Math.max(1, displayWidth(code.original, endCharacter) - start);
  return `${gutter}│ ${lead}${' '.repeat(start)}${single[2][0].repeat(length)}${single[3]}`;
}

/** A stack line `<path> <line>:<column>[  <member>]`; a path this pass served is matched as written (spaces included), the longest form winning. */
function parseStackLine(pass: Pass, line: string): StackFrame | null {
  if (/[│╷╵┌└━]/.test(line)) return null;
  const indent = (/^\s*/.exec(line) as RegExpExecArray)[0];
  const rest = line.slice(indent.length);
  if (!rest) return null;
  let best: StackFrame | null = null;
  for (const file of pass.served.keys()) {
    for (const form of [file, path.relative(process.cwd(), file)]) {
      if (!form || !rest.startsWith(`${form} `)) continue;
      const position = /^(\d+):(\d+)(?: {2,}(.*))?$/.exec(rest.slice(form.length + 1));
      if (position && (!best || form.length > best.pathText.length)) best = { indent, pathText: form, file, line: Number(position[1]), column: Number(position[2]), member: position[3] };
    }
  }
  if (best) return best;
  const generic = /^(\S.*?) (\d+):(\d+)(?: {2,}(.*))?$/.exec(rest);
  return generic ? { indent, pathText: generic[1], file: null, line: Number(generic[2]), column: Number(generic[3]), member: generic[4] } : null;
}

/** Frames aligned as Sass aligns them: each location padded to the longest, two spaces, the member. */
function alignFrames(frames: StackFrame[]): string[] {
  const locations = frames.map((frame) => `${frame.pathText} ${frame.line}:${frame.column}`);
  const width = Math.max(...locations.map((location) => location.length));
  return frames.map((frame, index) => (frame.member !== undefined ? `${frame.indent}${locations[index].padEnd(width)}  ${frame.member}` : `${frame.indent}${locations[index]}`));
}

/** The stack blocks of a frame with the columns of served `.uxdsl` files translated, re-aligned when a column changed. */
function restack(pass: Pass, lines: string[]): string[] {
  const out = lines.slice();
  for (let i = 0; i < out.length; i++) {
    const block: StackFrame[] = [];
    for (let j = i; j < out.length; j++) {
      const frame = parseStackLine(pass, out[j]);
      if (!frame) break;
      block.push(frame);
    }
    if (block.length === 0) continue;
    let changed = false;
    for (const frame of block) {
      if (!frame.file) continue;
      const column = columnIn(pass, frame.file, frame.line - 1, frame.column - 1) + 1;
      if (column !== frame.column) {
        frame.column = column;
        changed = true;
      }
    }
    if (changed) alignFrames(block).forEach((text, k) => { out[i + k] = text; });
    i += block.length - 1;
  }
  return out;
}

// --- warnings ----------------------------------------------------------------------------

function convertWarning(pass: Pass, warn: SassWarn): CompileWarning {
  const firstLine = warn.message.split(/\r?\n/)[0];
  const text = warn.deprecationType ? `UXD_SASS_WARNING: [${warn.deprecationType.id}] ${firstLine}` : `UXD_SASS_WARNING: ${firstLine}`;
  const span = warn.span;
  const url = span ? span.url : undefined;
  if (span && url && url.protocol === 'file:') {
    const file = fileURLToPath(url);
    return { text, file, line: span.start.line + 1, column: columnIn(pass, file, span.start.line, span.start.column) + 1 };
  }
  // An @warn has no span: its stack's first frame is the only location Sass gives.
  if (typeof warn.stack === 'string' && warn.stack !== '' && warn.stack !== 'null') {
    const frame = locateFrame(pass, warn.stack.split('\n')[0]);
    if (frame) return { text, ...frame };
  }
  return { text };
}

/** The file, line and author's column of a stack frame naming a file of this pass (served, or loaded by Sass); never guessed. */
function locateFrame(pass: Pass, line: string): { file: string; line: number; column: number } | null {
  const known = new Set(pass.served.keys());
  if (pass.result) for (const url of pass.result.loadedUrls) if (url.protocol === 'file:') known.add(fileURLToPath(url));
  let best: { form: string; file: string; line: number; column: number } | null = null;
  for (const file of known) {
    for (const form of [file, path.relative(process.cwd(), file)]) {
      if (!form || !line.startsWith(`${form} `)) continue;
      const position = /^(\d+):(\d+)(?= |$)/.exec(line.slice(form.length + 1));
      if (position && (!best || form.length > best.form.length)) best = { form, file, line: Number(position[1]), column: Number(position[2]) };
    }
  }
  if (!best) return null;
  return { file: best.file, line: best.line, column: columnIn(pass, best.file, best.line - 1, best.column - 1) + 1 };
}

// --- the source map --------------------------------------------------------------------------

/** Sass's map with the author's columns, paths for file: URLs and the original text of every served file. */
function translateMap(pass: Pass, map: RawSourceMap): RawSourceMap {
  const toPath = (source: string): string => (source.startsWith('file:') ? fileURLToPath(source) : source);
  const rewritten = [...pass.served.values()].some((served) => served.protected !== null && served.text !== served.original);
  if (!rewritten) {
    const sources = map.sources.map(toPath);
    const sourcesContent = sources.map((file, index) => {
      const served = pass.served.get(file);
      return served ? served.original : map.sourcesContent ? map.sourcesContent[index] : null;
    });
    return { ...map, sources, sourcesContent: sourcesContent as string[] };
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { SourceMapConsumer, SourceMapGenerator } = require('source-map-js') as typeof import('source-map-js');
  const consumer = new SourceMapConsumer(map);
  const generator = new SourceMapGenerator(map.file ? { file: map.file } : undefined);
  consumer.eachMapping((mapping) => {
    if (mapping.source === null || mapping.originalLine === null || mapping.originalColumn === null) {
      generator.addMapping({ generated: { line: mapping.generatedLine, column: mapping.generatedColumn } });
      return;
    }
    const file = toPath(mapping.source);
    generator.addMapping({
      generated: { line: mapping.generatedLine, column: mapping.generatedColumn },
      original: { line: mapping.originalLine, column: columnIn(pass, file, mapping.originalLine - 1, mapping.originalColumn) },
      source: file,
      name: mapping.name,
    });
  });
  for (const source of consumer.sources) {
    const file = toPath(source);
    const served = pass.served.get(file);
    const content = served ? served.original : consumer.sourceContentFor(source, true);
    if (content !== null) generator.setSourceContent(file, content);
  }
  return generator.toJSON();
}
