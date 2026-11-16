import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
// Types only: nothing in this module loads Dart Sass or source-map-js until a
// compilation runs (`require` inside the functions below).
import type * as Sass from 'sass';
import type { RawSourceMap } from 'source-map-js';
import type { CompileWarning } from '../compile';
import { diagnostic } from '../diagnostics';
import { KNOWN_CSS_FUNCTIONS } from '../language';
import { findShadowingFunctions, findTopLevelVariables, protect, TOKEN_FUNCTION_NAMES } from './protect';
import type { ProtectCall, ProtectNearMiss, ProtectProblem, ProtectResult, TopLevelVariable } from './protect';

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
//   searched as Dart Sass searches a load path: the URL is joined to it, both
//   kept as written, so the filesystem walks a leading `..` in the URL, and any
//   `..` in the load path, from the directories named (one that does not exist
//   finds nothing). `pkg:` URLs are Dart Sass's
//   `NodePackageImporter`'s, and so is a relative URL inside a package it
//   loaded, Sass's own extensions first: there a `.uxdsl` partial is found
//   only when no `.sass`, `.scss` or `.css` file (nor a directory index)
//   answers the URL, and one beside a `.scss` of the same name is not
//   reported as ambiguous. Canonical paths are normalized, have the on-disk
//   case on case-insensitive systems and keep symlinks, as Dart Sass's
//   filesystem importer does: each component's case is read from its real
//   path, and a directory is listed only to spell a symlink's own name. Three
//   names keep a spelling that differs from Dart Sass's: a name stored in NFD
//   and written in NFC keeps its written name, a symlinked directory written
//   in another case keeps the link's name as its directory lists it, and a
//   name in a directory that cannot be listed keeps its written case.
// - Files are read as Dart Sass reads them (UTF-8; a BOM is a character; text
//   that is not valid UTF-8 is Sass's `Invalid UTF-8.` at the first bad
//   character). A `.uxdsl` file goes through `protect()`, and the result lists
//   the near-miss calls protect rewrote in the files loaded; `.scss`, `.sass`
//   and `.css` are served as written.
// - A Sass failure is a `UXD_SASS` error at the author's file, line and column
//   (columns translated back through protect's map), with Sass's message, its
//   code frame and stack re-rendered with the author's text (`sassFrame`), and
//   the `sass.Exception` as `cause`. An I/O error is rethrown unchanged.
// - Every Sass warning is a `UXD_SASS_WARNING: …` warning, located like an
//   error; an `@warn` is located by its stack frame. Sass's own cap (five per
//   deprecation type, then a summary) applies. Each evaluation of an `@debug`
//   in any loaded file is a `UXD_SASS_WARNING: DEBUG: …` warning at its rule,
//   in Sass's order among the others.
// - With `sourceMap`, the map has the author's columns, absolute paths as
//   sources and the original text as sourcesContent.
// - A project `@function` named like a UXDSL function (a token function,
//   `tone`, a reserved breakpoint name) wins exactly where Dart Sass calls its
//   bare name. Sass decides visibility: a probe compile records, at each token
//   call written in a `.uxdsl` file, whether the bare name means a project
//   function there; a call Sass resolves to the project function is left as
//   written, any other keeps UXDSL's token, and a call seen both ways is
//   written as a choice that replays, at each evaluation, what the probe
//   recorded at that evaluation. A call Sass never evaluates (a pseudo-class
//   argument it keeps as raw text) keeps the token, the text Sass leaves
//   there. The probe reads visibility with Sass's global meta functions
//   (`function-exists`, `get-function`) and gives no file Sass `@import`s a
//   `@use`, since Sass evaluates such a file apart from the importing file's
//   modules once it has one. Where a loaded file defines a function named
//   `function-exists` or `get-function`, which would answer those, the probe
//   reads them through `sass:meta` under the probe's own namespace instead: a file
//   Sass never `@import`s gets the `@use` that brings it in, and a file it
//   `@import`s reaches the namespace of the file importing it; one that Sass
//   evaluates at its top level apart from an importing file that has the
//   namespace has a `@use` of its own, so it gets the `@use` too. Elsewhere (a
//   file also loaded as a module; a file with a `@use` of its own that another
//   imported file imports, or whose lookups are only in a mixin included
//   elsewhere; a file that a module in the indented syntax or one Dart Sass
//   loads itself imports) its lookups go back to the global functions, which
//   the project's function then answers where it is visible there. Where two
//   modules used `as *` define a name, the lookup fails as a bare call does,
//   so such a call is left as written and the error is Sass's. Each
//   definition some bare call resolves to is one `UXD_FUNCTION_SHADOWED`
//   warning at the definition: the probe captures the function each
//   evaluation of a definition creates (a file imported twice defines its
//   functions twice, and a file may define a name twice), so the warning goes
//   to the definition the call reached. Two
//   definitions of one name in indented `.sass` files or in files Sass loads
//   itself (`pkg:`), which the probe does not capture, both warn when either is
//   reached. Dart Sass's own files are known only from a compile that
//   succeeds, so when the first compile fails and a file names a `pkg:` URL,
//   every token call is probed until a probe compiles: a `pkg:` package's
//   function wins where Sass calls it even when UXDSL's token in its place
//   would not compile. A build with no such definition and no `!default`
//   candidate (below) runs Dart Sass once, unless that compile fails and a file
//   the importer served contains the text `pkg:`.
// - Three things a file loaded with `@use` or `@forward` does not see, since
//   it is its own Sass module, change a build that compiles; each is one
//   `UXD_MODULE_ISOLATION` warning, and the CSS is Dart Sass's:
//   - a call Dart Sass leaves in its output as written while a loaded file
//     defines a `@function` of that name (`_` read as `-`), not a CSS function
//     the compiler knows, a UXDSL function or a breakpoint: one per author
//     position and name, located through the map where `compile()` locates
//     any other position in the output; only the values of declarations Sass
//     evaluates are read, and only with `sourceMap`;
//   - a definition named like a UXDSL function that the probe instruments
//     (a `.uxdsl` or `.scss` file) and that no evaluation reaches, while a
//     call of its name written in a `.uxdsl` file evaluated with no function
//     of that name visible, keeping the token: at the definition. The probe
//     records each evaluation of such a body with a statement at its start,
//     whatever reached it (a bare call, a namespace, another function,
//     `meta.call`). Not reported where a loaded file defines one of the meta
//     functions the probe reads;
//   - a top-level `$name: … !default` in a `.uxdsl` file loaded as a module
//     whose default applied after an earlier loaded `.uxdsl` or `.scss` file,
//     one that emits no CSS (no mapping of the output points into it),
//     assigned `$name` at its top level: at the declaration, naming the last
//     such file. The candidates come from the first pass with no compile, and
//     only with `sourceMap`; for them alone a probe precedes each candidate
//     declaration with a guarded twin whose value Sass evaluates exactly when
//     the default would apply (no `with` configuration included) and which
//     assigns null, riding on the shadowing probe when that runs and
//     otherwise compiling once more, reporting nothing when that compile
//     fails or its CSS differs from the first pass's.
//   They follow `UXD_FUNCTION_SHADOWED`, by load order, line and column, and
//   only a stage that succeeds reports them.
// - Nothing is shared between calls: every cache lives in one call's state,
//   and every position is translated with the pass that produced it. Every
//   pass sees the text first read for each file the importer serves; a file
//   Dart Sass loads itself (`pkg:`) is read by Sass in each pass. Every name
//   the probe writes into what Sass compiles (its functions, and the namespace
//   under which it reaches `sass:meta`) carries a tag made at random for each
//   call, so no name a project writes is one of them, and none reaches a
//   result: the CSS, the map, the loaded files, a warning or an error.

export interface SassStageInput {
  /** Absolute path of the entry. With `source`, the text is compiled as if it were this file, which need not exist. */
  entry: string;
  /** In-memory text of the entry. */
  source?: string;
}

export interface SassStageOptions {
  /** The effective theme's breakpoint names. With the token functions and `tone`, the names a project `@function` is checked against (`UXD_FUNCTION_SHADOWED`). */
  reserved: Iterable<string>;
  /** true: Dart Sass runs with a source map and the result carries it, translated. false: no map, and no `UXD_MODULE_ISOLATION` for a call left as written or a `!default`. */
  sourceMap: boolean;
  /** Directories searched, in order, for a URL with no scheme that is not found relative to the importing file, each as Dart Sass searches a load path (a leading `..` in the URL is walked from the directory itself, so one that does not exist finds nothing); relative entries are appended to `process.cwd()`, each kept as written. Default: every `node_modules` from the entry's directory up to the root, nearest first. The directories of the `SASS_PATH` environment variable are searched after these, as Dart Sass searches them. */
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
  /** The near-miss calls protect rewrote in the `.uxdsl` files loaded (`palete(primary.main)`, which Dart Sass cannot parse), in load order, each with its file and that file's text. The plugin reports each one Sass evaluated; one in a declaration Sass never evaluated is in no CSS. */
  nearMisses: SassStageNearMiss[];
  /** Sass's warnings and `@debug` output in Sass's order (`UXD_SASS_WARNING: [<id>] <first line>`, `UXD_SASS_WARNING: DEBUG: <first line>` or `UXD_SASS_WARNING: <first line>`), then one `UXD_FUNCTION_SHADOWED: …` per shadowing definition, located at the definition, then the `UXD_MODULE_ISOLATION: …` warnings by load order, line and column. */
  warnings: CompileWarning[];
}

export interface SassStageNearMiss extends ProtectNearMiss {
  /** Absolute. */
  file: string;
  /** The file's text as read. */
  source: string;
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
  /** What `SassStageResult.warnings` would have held, up to the failure. Every error the stage throws after Sass ran carries it. */
  warnings: CompileWarning[];
}

type Role = 'uxdsl' | 'scss' | 'sass' | 'css';
type Kind = 'file' | 'dir' | null;
type Decision = 'user' | 'token' | 'mixed';

const SYNTAX: Record<Role, Sass.Syntax> = { uxdsl: 'scss', scss: 'scss', sass: 'indented', css: 'css' };
const FOLDS_CASE = process.platform === 'darwin' || process.platform === 'win32';
/** Sass's meta functions the probe calls to read what a bare name means; a project function of one of these names would answer a call by that name. */
const META_FUNCTIONS = ['function-exists', 'get-function'];

/** The names the probe writes into what Sass compiles, all made from one random tag per call. */
interface ProbeNames {
  /** The name of the probe's function for `role` (`site`, `pick`, …). */
  fn(role: string): string;
  /** The namespace under which the probe reaches `sass:meta` in a build that defines a function named like one of META_FUNCTIONS. */
  metaNamespace: string;
  /** The `@use` that brings `sass:meta` in under that namespace, as the first text of a file. */
  metaPrefix: string;
  /** Sass's error for a lookup through the namespace where the scope Sass evaluates holds none. */
  missingNamespace: string;
  /** A span that is exactly one of the probe's lookups. */
  lookupCall: RegExp;
}

function probeNames(): ProbeNames {
  const tag = randomBytes(8).toString('hex');
  const fn = (role: string): string => `uxdsl-probe-${tag}-${role}`;
  const metaNamespace = fn('meta');
  return {
    fn,
    metaNamespace,
    metaPrefix: `@use "sass:meta" as ${metaNamespace}; `,
    missingNamespace: `There is no module with namespace "${metaNamespace}".`,
    lookupCall: new RegExp(`^(?:${metaNamespace}\\.)?(?:${META_FUNCTIONS.join('|')})\\("[^"]*"\\)$`),
  };
}
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
  /** The probe's names for this call. */
  probeNames: ProbeNames;
  /** Dart Sass's `pkg:` importer, made on first use. */
  packageImporter?: Sass.NodePackageImporter;
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
  /** An `@debug`, not a warning. */
  debug?: true;
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
  /** The files Sass loaded for an `@import`: it evaluates such a file in the importing file's scope, unless the file has a `@use` or `@forward` of its own. */
  imported: Set<string>;
  warns: SassWarn[];
  result: Sass.CompileResult | null;
  failed: boolean;
  error: unknown;
}

interface PassHooks {
  /** Reports to the caller: the real logger and the map option. Otherwise Sass's silent logger and no map. */
  report: boolean;
  site?: (siteId: string, file: string, call: ProtectCall) => string | null | undefined;
  /** The text Sass receives for a file, from what it would receive otherwise (protect's output for a `.uxdsl` file, the original for the others). */
  instrument?: (file: string, role: Role, text: string, served: { protected: ProtectResult | null; plainCalls: Site[] }) => string;
  /** Whether a `.uxdsl` or `.scss` file gets the `sass:meta` prefix (a `@use`, so never for a file Sass may `@import`); asked after its calls were decided and the file instrumented. */
  prefix?: (file: string) => boolean;
  functions?: Record<string, Sass.CustomFunction<'sync'>>;
}

interface Definition extends ProtectProblem {
  file: string;
}

/** Located warnings of the stage's own, before they are ordered. */
type LocatedWarning = CompileWarning & { file: string; line: number; column: number };

/** What the probe decided: the pass to report, the definitions some bare call resolves to, and a warning for each token-named definition no call reaches while a bare call of its name keeps the token. */
interface Shadowing {
  report: Pass;
  shadowing: Definition[];
  unreached: LocatedWarning[];
  /** When the probe ran with the `!default` candidates' records: what it recorded, in Sass's evaluation order. */
  defaultRecords: string[] | null;
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
  let reported: Shadowing = { report: first, shadowing: [], unreached: [], defaultRecords: null };
  try {
    rethrowNonSass(stage, first);
    const defaults = defaultCandidates(stage, first);
    reported = resolveShadowing(stage, first, defaults);
    const records = defaults ? reported.defaultRecords || probeDefaults(stage, first, defaults) : null;
    const applied = defaults && records ? defaultsApplied(stage, first, defaults, records) : [];
    return finish(stage, reported.report, reported.shadowing, [...reported.unreached, ...applied]);
  } catch (error) {
    if (error && typeof error === 'object') (error as { warnings?: CompileWarning[] }).warnings = stageWarnings(reported.report, reported.shadowing);
    throw error;
  }
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
    loadPaths: [...(options.loadPaths ? options.loadPaths.map(asWritten) : nodeModulesChain(entryPath)), ...sassPathDirectories()],
    entryPath,
    entryUrl: pathToFileURL(entryPath),
    sourceMap: options.sourceMap === true,
    silenceDeprecations: options.sass ? options.sass.silenceDeprecations : undefined,
    quietDeps: options.sass ? options.sass.quietDeps : undefined,
    files,
    texts,
    fileIds: new Map(),
    probeNames: probeNames(),
  };
}

/**
 * The directories of the `SASS_PATH` environment variable, which Dart Sass
 * reads on every compile and searches after the load paths: split on `;` on
 * win32 and `:` elsewhere, each taken as written (an empty entry is the working
 * directory itself). The importer searches them itself, so a `.uxdsl` file
 * there is found as a `.scss` file is.
 */
function sassPathDirectories(): string[] {
  const value = process.env.SASS_PATH;
  return value === undefined ? [] : value.split(process.platform === 'win32' ? ';' : ':').map(asWritten);
}

/** A directory to search as Dart Sass keeps a load path: an absolute one as given, a relative one appended to the working directory, neither normalized, so the filesystem walks any `..` in it. */
const asWritten = (directory: string): string => (path.isAbsolute(directory) ? directory : joinRaw(process.cwd(), directory));

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

/** Stat, on-disk case and whether a directory can be listed, cached for one call. */
function filesystem(): Files {
  const kinds = new Map<string, Kind>();
  const cases = new Map<string, string>();
  const listable = new Map<string, boolean>();
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
  const canList = (dir: string): boolean => {
    let found = listable.get(dir);
    if (found === undefined) {
      try {
        fs.accessSync(dir, fs.constants.R_OK);
        found = true;
      } catch {
        found = false;
      }
      listable.set(dir, found);
    }
    return found;
  };
  const isSymlink = (file: string): boolean => {
    try {
      return fs.lstatSync(file).isSymbolicLink();
    } catch {
      return false;
    }
  };
  // `name` as `dir` lists it: the one entry equal to it under toLowerCase(), else the name as written.
  const listedName = (dir: string, name: string): string => {
    try {
      const lower = name.toLowerCase();
      const matches = fs.readdirSync(dir).filter((entry) => entry.toLowerCase() === lower);
      return matches.length === 1 ? matches[0] : name;
    } catch {
      return name;
    }
  };
  // Each component in its on-disk case, symlinks kept, as Dart Sass's filesystem
  // importer canonicalizes on darwin and win32; a directory is listed only to
  // spell a symlink's own name.
  // - A component that is not a symlink takes its name from its real path:
  //   `real` when the caller has it, else fs.realpathSync.native. Its directory
  //   is given the real path's directory, which is that directory's own real
  //   path, since the component is not a symlink. The real path's name is kept
  //   where it equals the name as written under toLowerCase() and its directory
  //   can be listed; elsewhere (a name stored in NFD and written in NFC, a
  //   directory that cannot be listed, a path with no real path) the name stays
  //   as written.
  // - A symlink keeps its own name, spelled as its directory lists it, and that
  //   directory is spelled from its own real path, never from the link's target.
  const spell = (file: string, real?: string): string => {
    if (!FOLDS_CASE) return file;
    const cached = cases.get(file);
    if (cached !== undefined) return cached;
    const dir = path.dirname(file);
    const base = path.basename(file);
    let result: string;
    if (dir === file) {
      result = process.platform === 'win32' ? file.charAt(0).toUpperCase() + file.slice(1) : file;
    } else if (isSymlink(file)) {
      const realDir = spell(dir);
      result = path.join(realDir, listedName(realDir, base));
    } else {
      let resolved = real;
      if (resolved === undefined) {
        try {
          resolved = fs.realpathSync.native(file);
        } catch {
          // No real path: the name stays as written.
        }
      }
      if (resolved === undefined) {
        result = path.join(spell(dir), base);
      } else {
        const realDir = spell(dir, path.dirname(resolved));
        const onDisk = path.basename(resolved);
        result = path.join(realDir, onDisk !== base && onDisk.toLowerCase() === base.toLowerCase() && canList(realDir) ? onDisk : base);
      }
    }
    cases.set(file, result);
    return result;
  };
  return { kind, realCase: (file) => spell(file) };
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
 * decoded path joined to the load path, both as written. Sass has already
 * removed every dot segment from the URL but its leading `..` segments, and the
 * filesystem walks those, and any `..` in the load path, from the directories
 * named: under a load path that does not exist nothing is found, and under a
 * symlinked one `..` leads where the link points. An absolute path in the URL
 * replaces the load path, as Sass's join does.
 */
function underLoadPath(loadPath: string, url: string): string | null {
  const directory = loadPath.endsWith(path.sep) ? loadPath : loadPath + path.sep;
  // The URL is decoded against a file: URL of the directory, which normalizes it; the decoded rest
  // is then appended to the directory as written.
  const base = pathToFileURL(directory);
  const normalized = filePath(base);
  if (normalized === null) return null;
  const parents = (/^(?:\.\.(?:\/|$))*/.exec(url) as RegExpExecArray)[0];
  // The rest has no dot segment left, so it resolves inside the directory unless it is absolute.
  const resolved = resolveUrl(parents === '' ? url : `./${url.slice(parents.length)}`, base);
  if (resolved === null) return null;
  if (!resolved.startsWith(normalized)) return parents === '' ? resolved : null;
  return directory + parents.split('/').join(path.sep) + resolved.slice(normalized.length);
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
  return { served: new Map(), sites: new Map(), plainCalls: [], stash: null, imported: new Set(), warns: [], result: null, failed: false, error: undefined };
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
  if (hooks.instrument) text = hooks.instrument(file, role, text, { protected: protectedResult, plainCalls: filePlainCalls });
  if ((role === 'uxdsl' || role === 'scss') && hooks.prefix && hooks.prefix(file)) {
    // After a BOM, which must stay the first character.
    prefixAt = text.charCodeAt(0) === 0xfeff ? 1 : 0;
    text = text.slice(0, prefixAt) + stage.probeNames.metaPrefix + text.slice(prefixAt);
    prefixLength = stage.probeNames.metaPrefix.length;
  }
  const served: Served = { original, text, role, protected: protectedResult, prefixAt, prefixLength };
  pass.served.set(file, served);
  return served;
}

function runPass(stage: Stage, hooks: PassHooks): Pass {
  const { sass } = stage;
  const pass = newPass();
  const importer: Sass.Importer<'sync'> = {
    canonicalize: (url, context) => {
      const found = canonicalize(stage, url, context);
      if (found !== null && context.fromImport) pass.imported.add(fileURLToPath(found));
      return found;
    },
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
        debug: (message, options) => {
          pass.warns.push({ message, span: options.span, debug: true });
        },
      }
    : sass.Logger.silent;
  const map = hooks.report && stage.sourceMap;
  try {
    pass.result = sass.compileString(entry.text, {
      url: stage.entryUrl,
      syntax: SYNTAX[entry.role],
      importer,
      importers: [importer, packageImporter(stage)],
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

/**
 * Dart Sass's `pkg:` importer for this call, whose entry-point directory is
 * the entry's. Its constructor reads the main module's file name
 * (`require.main`, then `process.argv[1]`) even when it is given a directory,
 * and throws when Node read the main module from standard input (`node -`,
 * where `process.argv[1]` is `-`, not a file path). There the importer is given
 * the working directory, and is constructed with `process.argv` holding only
 * the executable, restored as soon as the constructor returns or throws.
 */
function packageImporter(stage: Stage): Sass.NodePackageImporter {
  if (stage.packageImporter) return stage.packageImporter;
  const main = process.argv[1];
  if (typeof main === 'string' && !path.isAbsolute(main)) {
    const argv = process.argv;
    process.argv = argv.slice(0, 1);
    try {
      stage.packageImporter = new stage.sass.NodePackageImporter(process.cwd());
    } finally {
      process.argv = argv;
    }
  } else {
    stage.packageImporter = new stage.sass.NodePackageImporter(path.dirname(stage.entryPath));
  }
  return stage.packageImporter;
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

function finish(stage: Stage, pass: Pass, shadowing: Definition[], isolated: LocatedWarning[]): SassStageResult {
  rethrowNonSass(stage, pass);
  if (pass.failed) throw stageError(pass, pass.error as Sass.Exception);
  const result = pass.result as Sass.CompileResult;
  const loadedFiles = loadedFilesOf(pass);
  const nearMisses = loadedFiles.flatMap((file) => {
    const served = pass.served.get(file);
    return served && served.protected ? served.protected.nearMisses.map((miss) => ({ ...miss, file, source: served.original })) : [];
  });
  const out: SassStageResult = { css: result.css, loadedFiles, warnings: stageWarnings(pass, shadowing), nearMisses };
  if (stage.sourceMap && result.sourceMap) out.map = translateMap(pass, result.sourceMap);
  const isolation = [...isolated, ...(out.map ? leftAsWritten(stage, pass, result.css, out.map) : [])];
  out.warnings.push(...sortedByLoadOrder(isolation, loadedFiles));
  return out;
}

/** The files `pass` loaded: Sass's load order when it compiled, the order the importer served them otherwise. */
function loadedFilesOf(pass: Pass): string[] {
  if (!pass.result) return [...pass.served.keys()];
  return pass.result.loadedUrls.filter((url) => url.protocol === 'file:').map((url) => fileURLToPath(url));
}

/** Sass's warnings in Sass's order, then one per shadowing definition, in load order. */
function stageWarnings(pass: Pass, shadowing: Definition[]): CompileWarning[] {
  const loadedFiles = loadedFilesOf(pass);
  const order = (file: string): number => {
    const index = loadedFiles.indexOf(file);
    return index === -1 ? loadedFiles.length : index;
  };
  const shadow = shadowing
    .slice()
    .sort((a, b) => order(a.file) - order(b.file) || a.line - b.line || a.column - b.column)
    .map((definition): CompileWarning => ({ text: definition.message, file: definition.file, line: definition.line, column: definition.column }));
  return [...pass.warns.map((warn) => convertWarning(pass, warn)), ...shadow];
}

// --- module isolation ------------------------------------------------------------------

/** Sass treats `_` and `-` as the same character in a name. */
const sassSpelling = (name: string): string => name.replace(/_/g, '-');

/** Located warnings sorted by the load order of their files, then line and column. */
function sortedByLoadOrder(warnings: LocatedWarning[], loadedFiles: string[]): CompileWarning[] {
  const order = (file: string): number => {
    const index = loadedFiles.indexOf(file);
    return index === -1 ? loadedFiles.length : index;
  };
  return warnings.slice().sort((a, b) => order(a.file) - order(b.file) || a.line - b.line || a.column - b.column);
}

/** The namespace a `@use` of `file` gets by default (its name without a leading `_` and its extensions; an index file's directory), or null when that is not a name to write in a call. */
function namespaceOf(file: string): string | null {
  let name = path.basename(file).replace(/^_/, '').split('.')[0];
  if (name === 'index') name = path.basename(path.dirname(file));
  return /^(?!\d)(?!--)[A-Za-z0-9_-]+$/.test(name) ? name : null;
}

/** The name written at a 1-based line and column of `text`. */
function writtenAt(text: string, line: number, column: number, fallback: string): string {
  const found = /^[A-Za-z0-9_-]+/.exec((text.split('\n')[line - 1] || '').slice(column - 1));
  return found ? found[0] : fallback;
}

/** A call in Dart Sass's output that could be a project function's: a name and its parenthesis, not after a character that makes it a selector, a variable, a member or a pseudo-class. */
const CALL_IN_OUTPUT = /(?<![A-Za-z0-9_.$%@&#\\:-])(-?[A-Za-z_][A-Za-z0-9_-]*)\(/g;
/** Names a call left as written is never reported under: the CSS functions the compiler knows and UXDSL's own, lowercase. */
const KNOWN_CALLS: ReadonlySet<string> = new Set([...(KNOWN_CSS_FUNCTIONS as readonly string[]).map((name) => name.toLowerCase()), ...TOKEN_FUNCTION_NAMES, 'tone']);
/** Functions whose arguments Dart Sass keeps as written, where a visible function is not called either. */
const RAW_ARGUMENTS = /^(?:url|expression|element|type|-[a-z]+-calc)$/i;

interface FunctionDefinition {
  file: string;
  line: number;
  column: number;
  written: string;
}

/**
 * One `UXD_MODULE_ISOLATION` warning per author position and name for each
 * call Dart Sass left in its output as written while a loaded file defines a
 * `@function` of that name (Sass's spelling), which is therefore not visible
 * there. Only the values of declarations Dart Sass evaluates are read: not a
 * custom property, a CSS `@function` body, a `progid:` value, the arguments
 * of `url()`, `expression()`, `element()`, `type()` or a vendor-prefixed
 * `calc()`, an at-rule's prelude, a selector, a comment or a string, where it
 * leaves even a visible function as written. Each call is located where
 * `compile()` locates a position in Dart Sass's output: the nearest mapping at
 * or before it on the stage's map. Output PostCSS cannot parse gives none;
 * `compile()` reports the parse error.
 */
function leftAsWritten(stage: Stage, pass: Pass, css: string, map: RawSourceMap): LocatedWarning[] {
  const reserved = new Set(stage.reserved.map((name) => name.toLowerCase()));
  const called = new Set<string>();
  for (const match of css.matchAll(CALL_IN_OUTPUT)) {
    const name = sassSpelling(match[1]);
    if (!KNOWN_CALLS.has(name.toLowerCase()) && !reserved.has(name.toLowerCase())) called.add(name);
  }
  if (called.size === 0) return [];
  const definers = new Map<string, FunctionDefinition[]>();
  for (const file of loadedFilesOf(pass)) {
    const role = roleOf(file);
    if (role === 'css') continue;
    const served = pass.served.get(file);
    const text = served ? served.original : stage.texts.get(file);
    if (text === undefined || !/@function/i.test(text)) continue;
    for (const problem of findShadowingFunctions(role === 'sass' ? blankIndentedComments(text) : text, { reserved: called, file })) {
      if (!called.has(problem.name)) continue;
      const definition = { file, line: problem.line, column: problem.column, written: writtenAt(text, problem.line, problem.column, problem.name) };
      const list = definers.get(problem.name);
      if (list) list.push(definition);
      else definers.set(problem.name, [definition]);
    }
  }
  if (definers.size === 0) return [];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const postcss = require('postcss') as typeof import('postcss');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const valueParser = require('postcss-value-parser') as typeof import('postcss-value-parser');
  let root: ReturnType<typeof postcss.parse>;
  try {
    root = postcss.parse(css);
  } catch {
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { SourceMapConsumer } = require('source-map-js') as typeof import('source-map-js');
  const consumer = new SourceMapConsumer(map);
  const seen = new Set<string>();
  const out: LocatedWarning[] = [];
  root.walkDecls((decl) => {
    if (decl.prop.startsWith('--') || /^\s*progid:/i.test(decl.value)) return;
    for (let ancestor: import('postcss').Node | undefined = decl.parent as import('postcss').Node | undefined; ancestor; ancestor = ancestor.parent as import('postcss').Node | undefined) {
      if (ancestor.type === 'atrule' && (ancestor as import('postcss').AtRule).name.toLowerCase() === 'function' && /^\s*--/.test((ancestor as import('postcss').AtRule).params)) return;
    }
    valueParser(decl.value).walk((node) => {
      if (node.type !== 'function') return undefined;
      if (RAW_ARGUMENTS.test(node.value)) return false;
      const name = sassSpelling(node.value);
      const definitions = definers.get(name);
      if (!definitions) return undefined;
      const at = decl.positionBy({ index: decl.prop.length + (decl.raws.between || '').length + node.sourceIndex });
      const original = consumer.originalPositionFor({ line: at.line, column: Math.max(0, at.column - 1) });
      if (original.source == null || original.line == null || original.column == null || roleOf(original.source) === 'css') return undefined;
      const file = original.source;
      const line = original.line;
      const column = original.column + 1;
      const key = `${file}\n${line}\n${column}\n${name}`;
      if (seen.has(key)) return undefined;
      seen.add(key);
      const own = definitions.find((definition) => definition.file === file);
      const definition = own || definitions[0];
      const namespace = namespaceOf(definition.file);
      const fix = own
        ? 'define it at the top level of its file, before this call'
        : `@use that file as * here, or call it through its namespace${namespace ? ` (${namespace}.${definition.written}())` : ''}`;
      out.push({ text: `UXD_MODULE_ISOLATION: @function ${definition.written} (${definition.file}:${definition.line}) is not visible here, so Dart Sass leaves ${node.value}() in the CSS as written; ${fix}`, file, line, column });
      return undefined;
    });
  });
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

/** A call written on one line, as the probe and the final pass write it in a choice. */
const oneLine = (raw: string): string => raw.replace(/\r\n|\r|\n/g, ' ');

/** What the bare name means where this expression is evaluated: the function, or null when no function of that name is visible. Read with Sass's global meta functions, or through `sass:meta` under `namespace` when one is given. */
const visibleFunction = (name: string, namespace: string | null): string => {
  const via = namespace !== null ? `${namespace}.` : '';
  return `if(sass(${via}function-exists("${name}")): ${via}get-function("${name}"); else: null)`;
};

const textOf = (value: Sass.Value): string => value.assertString().text;

/**
 * Finds the project functions named like UXDSL functions in every file the
 * build loaded and, when a `.uxdsl` file calls one of those names, lets Sass
 * decide each call: a probe compile records what the bare name means at every
 * evaluation of every candidate call, and a final compile (only when a
 * decision differs from the first pass) writes each call accordingly.
 */
function resolveShadowing(stage: Stage, first: Pass, defaults: DefaultCandidates | null): Shadowing {
  const { sass } = stage;
  const own = stage.probeNames;
  const definitions: Definition[] = [];
  const scanned = new Set<string>();
  const scannedTexts: Array<{ file: string; role: Role; text: string }> = [];
  const scanText = (file: string, role: Role, text: string, protectedResult: ProtectResult | null): void => {
    if (scanned.has(file)) return;
    scanned.add(file);
    scannedTexts.push({ file, role, text });
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
  const definedNames = (): Set<string> => new Set(definitions.map((definition) => definition.name));
  // Dart Sass loads a pkg: file itself, so the definitions in it are known only from a compile that
  // succeeds. When the first pass failed and a file it served names a pkg: URL, every token function
  // is a candidate until a probe compiles: Sass decides at each call whether the bare name means a
  // function there, and the files a compiling probe loaded are scanned like the others.
  let discovering = first.failed && [...first.served.values()].some((served) => served.original.includes('pkg:'));
  const candidateNames = (): Set<string> => (discovering ? new Set([...TOKEN_FUNCTION_NAMES, ...definedNames()]) : definedNames());
  let names = candidateNames();
  if (names.size === 0) return { report: first, shadowing: [], unreached: [], defaultRecords: null };
  const callsAName = (pass: Pass): boolean => [...pass.sites.values(), ...pass.plainCalls].some((site) => names.has(site.call.name));
  if (!first.failed && !callsAName(first)) return { report: first, shadowing: [], unreached: [], defaultRecords: null };

  // Which names are Sass's own global functions (color, and min/max/round/abs if a breakpoint is so named).
  const builtins = new Map<string, Sass.SassFunction>();
  const builtinsChecked = new Set<string>();
  const captureBuiltins = (): void => {
    const pending = [...names].filter((name) => !builtinsChecked.has(name));
    if (pending.length === 0) return;
    for (const name of pending) builtinsChecked.add(name);
    sass.compileString(['@use "sass:meta";', ...pending.map((name) => `$_: ${own.fn('builtin')}("${name}", if(sass(meta.function-exists("${name}")): meta.get-function("${name}"); else: null));`)].join('\n'), {
      logger: sass.Logger.silent,
      functions: {
        [`${own.fn('builtin')}($name, $f)`]: (args) => {
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
  // so the probe evaluates exactly what the build will. Lines appended at the end of `.uxdsl` files
  // record a name's meaning where protect never rewrites its calls, and a statement after the body of
  // each definition in a `.uxdsl` or `.scss` file captures the function that evaluation of it
  // created, for attribution. A statement at the start of each such body records every evaluation of
  // it, whatever reached it: a bare call, a namespace, another function of its module, `meta.call`.
  //
  // What a name means is read with Sass's global meta functions, function-exists and get-function,
  // so no file changes how Sass evaluates it. Where a loaded file defines a function of one of those
  // names, which would answer them, the lookups go through `sass:meta` under the probe's namespace
  // instead: a file Sass never `@import`s gets the `@use` that brings it in; a file it `@import`s
  // never does, since Sass evaluates an imported file that has a `@use` apart from the importing
  // file's modules, and reaches the importing file's namespace. A file Sass evaluates somewhere
  // without one (that lookup fails) goes back to the global functions, unless Sass evaluated it at
  // its top level for an `@import` in a file that had the `@use`: it has a `@use` of its own then,
  // so it gets the `@use` too. A round in which Sass `@import`ed a file that got the `@use` without
  // having one of its own is not the build's and runs again without it.
  let records = new Map<string, Array<{ fn: Sass.SassFunction | null }>>();
  let atEnd: Array<{ fileId: string; name: string; fn: Sass.SassFunction | null }> = [];
  /** The function each evaluation of a definition created, by definition (`<file id>:<line>:<column>`). */
  let captures: Array<{ definition: string; fn: Sass.SassFunction }> = [];
  /** The definitions the probe recorded at the start of their bodies, and those some evaluation of whose body it recorded. */
  let instrumented = new Set<string>();
  let called = new Set<string>();
  /** The `!default` candidates' records, when there are candidates. */
  let defaultRecords: string[] = [];
  // Calls Sass reads as raw text and never evaluates, where the probe's choice does not parse (a
  // pseudo-class argument in a selector, which Sass ends at the first ";"): they keep the token,
  // which is the text Sass leaves there.
  const unevaluated = new Set<string>();
  // Where two modules used `as *` define a name, Sass's own lookup of the bare name fails, as a bare
  // call does. A probed call where it fails is left as written, so Sass reports its error there. A
  // line at the end of a file where it fails is dropped: no bare call of that name Sass evaluates in
  // that file can compile, so none is attributed.
  const ambiguous = new Set<string>();
  const noEndLookup = new Set<string>();
  const imported = new Set<string>(first.imported);
  /** Files whose lookups go through the global meta functions in a build that defines one of their names: Sass found no namespace in the scope it evaluated them in. */
  const globalLookups = new Set<string>();
  /** Files Sass `@import`s that have a `@use` or `@forward` of their own, so one more changes nothing: such a file gets the `@use` too. */
  const ownModules = new Set<string>();
  let metaScanned = 0;
  let metaDefined = false;
  /** Whether a file scanned so far defines a function named like one of the meta functions the probe calls. */
  const metaShadowed = (): boolean => {
    for (; metaScanned < scannedTexts.length && !metaDefined; metaScanned++) {
      const { file, role, text } = scannedTexts[metaScanned];
      if (role === 'css') continue;
      const problems = findShadowingFunctions(role === 'sass' ? blankIndentedComments(text) : text, { reserved: META_FUNCTIONS, file });
      metaDefined = problems.some((problem) => META_FUNCTIONS.includes(problem.name));
    }
    return metaDefined;
  };
  /**
   * Where the failed probe stopped, when that is inside a text it wrote: a call's choice not yet
   * recorded, or a line at the end of a file. `lookup` when what failed is one of the probe's lookups
   * of the bare name; otherwise Sass could not parse the choice there. `namespace` when a lookup
   * through the probe's namespace failed in `file` because the scope Sass evaluated holds none;
   * `ownModules` when that scope is the file's own although Sass evaluated it at its top level for
   * an `@import` in a file that had the `@use`: Sass does that only for a file with a `@use` or
   * `@forward` of its own.
   */
  const failedAt = (pass: Pass, written: Map<string, string>, endLines: Map<string, string>, prefixed: Set<string>): { file: string; siteId?: string; endKey?: string; lookup: boolean; namespace: boolean; ownModules?: boolean } | null => {
    const error = pass.error;
    if (!(error instanceof sass.Exception) || !error.span || !error.span.url || error.span.url.protocol !== 'file:') return null;
    const file = fileURLToPath(error.span.url);
    const served = pass.served.get(file);
    if (!served) return null;
    if (error.sassMessage === own.missingNamespace) {
      if (globalLookups.has(file) || ownModules.has(file)) return null;
      const frames = error.sassStack.split('\n').map((line) => (line ? parseStackLine(pass, line) : null));
      const importedBy = frames.length > 1 && frames[0] && frames[0].file === file && frames[0].member === '@import' ? frames[1] : null;
      return { file, lookup: true, namespace: true, ownModules: importedBy !== null && importedBy.file !== null && prefixed.has(importedBy.file) };
    }
    const offset = error.span.start.offset;
    const lookup = own.lookupCall.test(error.span.text);
    const inside = (text: string): boolean => {
      const at = served.text.indexOf(text);
      return at !== -1 && offset >= at && offset < at + text.length;
    };
    for (const [siteId, text] of written) if (!records.has(siteId) && inside(text)) return { file, siteId, lookup, namespace: false };
    for (const [endKey, text] of endLines) if (lookup && inside(text)) return { file, endKey, lookup, namespace: false };
    return null;
  };
  let probe = first;
  for (let round = 1; ; round++) {
    if (round > parses.size + scanned.size + unevaluated.size + noEndLookup.size + imported.size + globalLookups.size + ownModules.size + 3) throw new Error('uxdsl: the Sass stage\'s probe did not settle (an internal error)');
    records = new Map();
    atEnd = [];
    captures = [];
    instrumented = new Set();
    called = new Set();
    defaultRecords = [];
    const written = new Map<string, string>();
    const endLines = new Map<string, string>();
    const meta = metaShadowed();
    const namespaced = (file: string): string | null => (meta && !globalLookups.has(file) ? own.metaNamespace : null);
    const prefixed = new Set<string>();
    const namesBefore = new Set(names);
    probe = runPass(stage, {
      report: false,
      site: (siteId, file, call) => {
        if (call.kind !== 'token' || !names.has(call.name)) return undefined;
        if (ambiguous.has(siteId)) return null;
        if (unevaluated.has(siteId) || !parseable(call)) return call.protectedText;
        const text = `${own.fn('pick')}(if(sass(${own.fn('site')}("${siteId}", "${call.name}", ${visibleFunction(call.name, namespaced(file))})): ${oneLine(call.raw)}; else: ${call.protectedText}))`;
        written.set(siteId, text);
        return text;
      },
      instrument: (file, role, text, served) => {
        const fileId = idOf(stage, file);
        let out = text;
        if (role === 'uxdsl' || role === 'scss') {
          // Right after a definition's body, in the scope that holds it, the bare name means the
          // function that evaluation of the definition created. The braces keep the statement inert
          // where Sass reads a value as raw text. At the start of the body, each evaluation of it is
          // recorded. Inserted from the last, and the end before the start, so earlier offsets hold.
          const defined = findShadowingFunctions(text, { reserved: stage.reserved, file, bodies: true });
          for (const definition of defined.reverse()) {
            if (definition.end === undefined || definition.bodyStart === undefined) continue;
            const column = served.protected ? served.protected.toOriginalColumn(definition.line - 1, definition.column - 1) + 1 : definition.column;
            const key = `${fileId}:${definition.line}:${column}`;
            out = `${out.slice(0, definition.end)}@if true { @debug ${own.fn('cap')}("${key}", ${visibleFunction(definition.name, namespaced(file))}); }${out.slice(definition.end)}`;
            out = `${out.slice(0, definition.bodyStart)}@debug ${own.fn('called')}("${key}");${out.slice(definition.bodyStart)}`;
            instrumented.add(key);
          }
        }
        const lines: string[] = [];
        if (role === 'uxdsl') {
          for (const name of new Set(served.plainCalls.map((site) => site.call.name))) {
            const endKey = `${fileId}:${name}`;
            if (!names.has(name) || noEndLookup.has(endKey)) continue;
            const line = `@debug ${own.fn('eof')}("${fileId}", "${name}", ${visibleFunction(name, namespaced(file))});`;
            endLines.set(endKey, line);
            lines.push(line);
          }
        }
        if (lines.length > 0) out = `${out}\n${lines.join('\n')}\n`;
        return defaults ? guardDefaults(stage, defaults, file, out) : out;
      },
      prefix: (file) => {
        if (!meta || (imported.has(file) && !ownModules.has(file))) return false;
        prefixed.add(file);
        return true;
      },
      functions: {
        [`${own.fn('site')}($id, $name, $f)`]: (args) => {
          const fn = userFunction(textOf(args[1]), args[2]);
          const id = textOf(args[0]);
          const list = records.get(id);
          if (list) list.push({ fn });
          else records.set(id, [{ fn }]);
          return fn ? sass.sassTrue : sass.sassFalse;
        },
        [`${own.fn('pick')}($value)`]: (args) => args[0],
        [`${own.fn('eof')}($file, $name, $f)`]: (args) => {
          atEnd.push({ fileId: textOf(args[0]), name: textOf(args[1]), fn: userFunction(textOf(args[1]), args[2]) });
          return sass.sassNull;
        },
        [`${own.fn('cap')}($definition, $f)`]: (args) => {
          if (args[1] instanceof sass.SassFunction) captures.push({ definition: textOf(args[0]), fn: args[1] });
          return sass.sassNull;
        },
        [`${own.fn('called')}($definition)`]: (args) => {
          called.add(textOf(args[0]));
          return sass.sassNull;
        },
        [`${own.fn('default')}($id)`]: (args) => {
          defaultRecords.push(textOf(args[0]));
          return sass.sassNull;
        },
      },
    });
    scanPass(probe);
    for (const file of probe.imported) imported.add(file);
    // A file that got the `@use` without having one of its own, and that Sass `@import`ed, was
    // evaluated apart from the importing file's modules, which the build does not do.
    const valid = ![...prefixed].some((file) => probe.imported.has(file) && !ownModules.has(file));
    if (valid && !probe.failed) discovering = false;
    names = candidateNames();
    checkParses(candidateRaws(probe));
    captureBuiltins();
    if (!valid || metaShadowed() !== meta) continue;
    const grew = [...names].some((name) => !namesBefore.has(name));
    const unprobed = [...probe.sites].some(([siteId, site]) => names.has(site.call.name) && parseable(site.call) && !unevaluated.has(siteId) && !ambiguous.has(siteId) && !written.has(siteId));
    const failed = probe.failed ? failedAt(probe, written, endLines, prefixed) : null;
    if (failed !== null && failed.namespace) {
      (failed.ownModules ? ownModules : globalLookups).add(failed.file);
      continue;
    }
    if (failed !== null && failed.siteId !== undefined) (failed.lookup ? ambiguous : unevaluated).add(failed.siteId);
    if (failed !== null && failed.endKey !== undefined) noEndLookup.add(failed.endKey);
    // The build fails where a call's lookup fails, so no later probe can change a decision.
    if (failed !== null && failed.siteId !== undefined && failed.lookup) break;
    if (!grew && !unprobed && failed === null) break;
  }

  const decisions = new Map<string, Decision>();
  for (const [siteId, site] of probe.sites) {
    if (!names.has(site.call.name)) continue;
    if (ambiguous.has(siteId)) {
      decisions.set(siteId, 'user');
      continue;
    }
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
  // A call seen both ways is written as a choice that replays, at each evaluation, what the probe
  // recorded at the same evaluation: the build evaluates the same calls in the same order, since the
  // values it writes are those the probe produced. It looks nothing up and adds no `@use`.
  const replayed = new Map<string, number>();
  let diverged = false;
  if (!reuse) {
    report = runPass(stage, {
      report: true,
      site: (siteId, _file, call) => {
        const decision = call.kind === 'token' ? decisions.get(siteId) : undefined;
        if (decision === undefined) return undefined;
        if (decision === 'user') return null;
        if (decision === 'token') return call.protectedText;
        return `${own.fn('pick')}(if(sass(${own.fn('replay')}("${siteId}")): ${oneLine(call.raw)}; else: ${call.protectedText}))`;
      },
      functions: {
        [`${own.fn('pick')}($value)`]: (args) => args[0],
        [`${own.fn('replay')}($id)`]: (args) => {
          const id = textOf(args[0]);
          const index = replayed.get(id) || 0;
          replayed.set(id, index + 1);
          const record = (records.get(id) || [])[index];
          if (record === undefined) diverged = true;
          return record !== undefined && record.fn !== null ? sass.sassTrue : sass.sassFalse;
        },
      },
    });
  }
  // The probe evaluates what the build emits: a probe that fails where the build does not, or a
  // build whose evaluations of a call differ from the probe's, is a bug here.
  if (probe.failed && !report.failed) throw new Error(`uxdsl: the Sass stage's probe failed where the build did not (an internal error): ${messageOf(probe.error)}`);
  const unreplayed = !probe.failed && !report.failed && [...decisions].some(([siteId, decision]) => decision === 'mixed' && replayed.get(siteId) !== (records.get(siteId) || []).length);
  if (diverged || unreplayed) throw new Error('uxdsl: the Sass stage\'s build evaluated a call other than its probe did (an internal error)');

  // One warning per definition that some evaluated bare call written in a .uxdsl file resolves to:
  // the definition one of whose evaluations created the function the call reached.
  const created = new Map<string, Sass.SassFunction[]>();
  for (const capture of captures) {
    const list = created.get(capture.definition);
    if (list) list.push(capture.fn);
    else created.set(capture.definition, [capture.fn]);
  }
  const createdBy = (definition: Definition): Sass.SassFunction[] => created.get(`${idOf(stage, definition.file)}:${definition.line}:${definition.column}`) || [];
  const attributed = (fn: Sass.SassFunction, definition: Definition): boolean => {
    const own = createdBy(definition);
    if (own.length > 0) return own.some((captured) => fn.equals(captured));
    // A definition the probe does not capture (in an indented .sass file, or a file Sass loads
    // itself): any function no other definition of the name created.
    return !definitions.some((other) => other !== definition && other.name === definition.name && createdBy(other).some((captured) => fn.equals(captured)));
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

  // A definition the probe recorded at the start of its body, which no evaluation reached, while a
  // call of its name written in a `.uxdsl` file evaluated with no function of that name visible there,
  // and so kept UXDSL's token. Not reported where a loaded file defines one of the meta functions the
  // probe reads, which can make it keep a token where Sass would call the function.
  const unreached: LocatedWarning[] = [];
  if (!metaShadowed()) {
    const fileOfId = new Map([...stage.fileIds].map(([file, id]) => [String(id), file]));
    const loaded = loadedFilesOf(report);
    const order = (file: string): number => {
      const index = loaded.indexOf(file);
      return index === -1 ? loaded.length : index;
    };
    const lineAt = (file: string, offset: number): number => {
      const served = probe.served.get(file);
      return served ? served.original.slice(0, offset).split('\n').length : 1;
    };
    /** The first call of `name`, in load order, that evaluated to UXDSL's token. */
    const tokenSite = (name: string): Site | null => {
      const found: Site[] = [];
      for (const [siteId, site] of probe.sites) {
        if (site.call.name !== name || unevaluated.has(siteId) || ambiguous.has(siteId)) continue;
        if ((records.get(siteId) || []).some((record) => record.fn === null)) found.push(site);
      }
      for (const record of atEnd) {
        if (record.name !== name || record.fn !== null) continue;
        const file = fileOfId.get(record.fileId);
        const plain = file === undefined ? undefined : probe.plainCalls.find((site) => site.file === file && site.call.name === name);
        if (plain) found.push(plain);
      }
      found.sort((a, b) => order(a.file) - order(b.file) || a.call.start - b.call.start);
      return found.length > 0 ? found[0] : null;
    };
    for (const definition of definitions) {
      const key = `${idOf(stage, definition.file)}:${definition.line}:${definition.column}`;
      if (!instrumented.has(key) || called.has(key) || shadowing.includes(definition)) continue;
      const site = tokenSite(definition.name);
      if (!site) continue;
      const served = probe.served.get(definition.file);
      const written = served ? writtenAt(served.original, definition.line, definition.column, definition.name) : definition.name;
      const namespace = namespaceOf(definition.file);
      const siteWritten = site.call.raw.slice(0, site.call.raw.indexOf('('));
      unreached.push({
        text: `UXD_MODULE_ISOLATION: @function ${written} (${definition.file}:${definition.line}) is reached by no call, and in ${site.file}:${lineAt(site.file, site.call.start)} the bare ${siteWritten}() is UXDSL's token, because the function is not visible there; @use that file as * there or call it through its namespace${namespace ? ` (${namespace}.${written}())` : ''} to use it, or remove or rename it to keep the token`,
        file: definition.file,
        line: definition.line,
        column: definition.column,
      });
    }
  }
  return { report, shadowing, unreached, defaultRecords: defaults ? defaultRecords : null };
}

// --- a !default an earlier file sets ------------------------------------------------------

/** Top-level `!default` names of the modules that may apply their default although an earlier file sets the name, and the earlier files' names, by file. */
interface DefaultCandidates {
  modules: Map<string, Set<string>>;
  earlier: Map<string, Set<string>>;
  loaded: string[];
}

/**
 * The candidates, from the first pass and with no compile: a `.uxdsl` file
 * Sass loaded as a module (not the entry, not for an `@import`) that declares
 * a top-level `$name: … !default`, and an earlier loaded `.uxdsl` or `.scss`
 * file that assigns `$name` at its top level without `!default` and emits no
 * CSS of its own (no mapping of the output points into it). Null without
 * one, and without a map.
 */
function defaultCandidates(stage: Stage, first: Pass): DefaultCandidates | null {
  if (!stage.sourceMap || first.failed || !first.result || !first.result.sourceMap) return null;
  const map = first.result.sourceMap;
  const loaded = loadedFilesOf(first);
  let emitting: Set<string> | null = null;
  const plain = new Map<string, TopLevelVariable[]>();
  const modules = new Map<string, Set<string>>();
  const earlier = new Map<string, Set<string>>();
  loaded.forEach((file, index) => {
    if (file === stage.entryPath || first.imported.has(file) || roleOf(file) !== 'uxdsl') return;
    const served = first.served.get(file);
    if (!served || !served.original.includes('!default')) return;
    const defaults = findTopLevelVariables(served.original).filter((variable) => variable.isDefault);
    if (defaults.length === 0) return;
    if (!emitting) emitting = new Set(map.sources.map((source) => (source.startsWith('file:') ? fileURLToPath(source) : source)));
    for (const before of loaded.slice(0, index)) {
      const role = roleOf(before);
      const text = first.served.get(before);
      if ((role !== 'uxdsl' && role !== 'scss') || !text || emitting.has(before) || !text.original.includes('$')) continue;
      let assigned = plain.get(before);
      if (!assigned) {
        assigned = findTopLevelVariables(text.original).filter((variable) => !variable.isDefault);
        plain.set(before, assigned);
      }
      for (const variable of defaults) {
        if (!assigned.some((other) => other.name === variable.name)) continue;
        (modules.get(file) || modules.set(file, new Set()).get(file) as Set<string>).add(variable.name);
        (earlier.get(before) || earlier.set(before, new Set()).get(before) as Set<string>).add(variable.name);
      }
    }
  });
  return modules.size > 0 ? { modules, earlier, loaded } : null;
}

/**
 * `text` (what Sass receives for `file`) with each candidate declaration
 * preceded by a guarded twin, `$name: <probe>("<kind>:<file id>:<line>:<name>") !default;`:
 * Sass evaluates its value exactly when the default would apply (the variable
 * unset or null, and no `with` configuration for it), the probe records it,
 * and the twin assigns null, so the declaration after it behaves as written.
 * `d` marks a module's `!default`, `s` an earlier file's assignment.
 */
function guardDefaults(stage: Stage, defaults: DefaultCandidates, file: string, text: string): string {
  const moduleNames = defaults.modules.get(file);
  const earlierNames = defaults.earlier.get(file);
  if (!moduleNames && !earlierNames) return text;
  const fileId = idOf(stage, file);
  let out = text;
  for (const variable of findTopLevelVariables(text).reverse()) {
    const kind = variable.isDefault ? (moduleNames && moduleNames.has(variable.name) ? 'd' : null) : earlierNames && earlierNames.has(variable.name) ? 's' : null;
    if (kind === null) continue;
    out = `${out.slice(0, variable.start)}$${variable.written}: ${stage.probeNames.fn('default')}("${kind}:${fileId}:${variable.line}:${variable.name}") !default; ${out.slice(variable.start)}`;
  }
  return out;
}

/** The candidates' records from a probe compile of their own (Sass's silent logger, no map); null when it fails or its CSS is not the first pass's. */
function probeDefaults(stage: Stage, first: Pass, defaults: DefaultCandidates): string[] | null {
  const records: string[] = [];
  const probe = runPass(stage, {
    report: false,
    instrument: (file, _role, text) => guardDefaults(stage, defaults, file, text),
    functions: {
      [`${stage.probeNames.fn('default')}($id)`]: (args) => {
        records.push(textOf(args[0]));
        return stage.sass.sassNull;
      },
    },
  });
  return !probe.failed && probe.result && first.result && probe.result.css === first.result.css ? records : null;
}

/** One warning per module `!default` whose default applied after an earlier candidate file had set the name, naming the last such file, at the declaration's `$`. */
function defaultsApplied(stage: Stage, first: Pass, defaults: DefaultCandidates, records: string[]): LocatedWarning[] {
  const fileOfId = new Map([...stage.fileIds].map(([file, id]) => [String(id), file]));
  const order = (file: string): number => defaults.loaded.indexOf(file);
  const out: LocatedWarning[] = [];
  const reported = new Set<string>();
  records.forEach((record, index) => {
    const [kind, fileId, line, name] = record.split(':');
    const file = fileOfId.get(fileId);
    if (kind !== 'd' || file === undefined || reported.has(record)) return;
    let setter: { file: string; line: string } | null = null;
    for (const earlier of records.slice(0, index)) {
      const [earlierKind, earlierId, earlierLine, earlierName] = earlier.split(':');
      const earlierFile = fileOfId.get(earlierId);
      if (earlierKind === 's' && earlierName === name && earlierFile !== undefined && earlierFile !== file && order(earlierFile) < order(file)) setter = { file: earlierFile, line: earlierLine };
    }
    if (!setter) return;
    const served = first.served.get(file);
    const declared = served ? findTopLevelVariables(served.original).find((variable) => variable.isDefault && variable.name === name && String(variable.line) === line) : undefined;
    if (!declared) return;
    reported.add(record);
    out.push({
      text: `UXD_MODULE_ISOLATION: $${declared.written}: … !default applies its default here, because the $${declared.written} that ${setter.file}:${setter.line} sets is not visible in this module; @use that file as * here, or configure this module with @use … with ($${declared.written}: …)`,
      file,
      line: declared.line,
      column: declared.column,
    });
  });
  return out;
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

/**
 * The served line Sass showed (after the frame's multi-line connector column, when it has one), or
 * null when the shown text is not that line. Sass shows a line that a multi-line span covers without
 * the carriage return that ends it in a CRLF file; the author's line is then taken without its own.
 */
function codeLine(pass: Pass, region: string | null, line0: number, shown: string): CodeLine | null {
  const served = region ? pass.served.get(region) : undefined;
  if (!served || !served.protected || !region) return null;
  const servedLine = served.text.split('\n')[line0];
  const originalLine = served.original.split('\n')[line0];
  if (servedLine === undefined || originalLine === undefined) return null;
  const connector = connectorBefore(shown, servedLine);
  if (connector !== null) return { file: region, line0, connector, served: servedLine, original: originalLine };
  if (!servedLine.endsWith('\r')) return null;
  const normalized = connectorBefore(shown, servedLine.slice(0, -1));
  if (normalized === null) return null;
  return { file: region, line0, connector: normalized, served: servedLine.slice(0, -1), original: originalLine.replace(/\r$/, '') };
}

/** What `shown` holds before `line` (tabs shown as four spaces): nothing or a multi-line connector column; null when `shown` does not end with that line. */
function connectorBefore(shown: string, line: string): string | null {
  const expanded = expandTabs(line);
  const width = shown.length - expanded.length;
  if (width < 0 || shown.slice(width) !== expanded) return null;
  const connector = shown.slice(0, width);
  return connector === '' || CONNECTOR.test(connector) ? connector : null;
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
  const text = warn.debug ? `UXD_SASS_WARNING: DEBUG: ${firstLine}` : warn.deprecationType ? `UXD_SASS_WARNING: [${warn.deprecationType.id}] ${firstLine}` : `UXD_SASS_WARNING: ${firstLine}`;
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
