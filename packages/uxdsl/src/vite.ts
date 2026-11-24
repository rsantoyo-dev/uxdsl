import fs from 'fs';
import path from 'path';
import type { Plugin, ResolvedConfig } from 'vite';
import { compile, referencesThemeTokens, themeEmissionWarning } from './compile';
import type { CompileConfig, CompileWarning, ThemeEmission } from './compile';
import { absentThemeCandidatePaths, collectLocalRequireTree, findThemeConfigPath, removedOptionWarnings } from './config';

// The bundler delivers real CSS through its own pipeline; UXDSL only
// compiles. `resolveId` turns `./panel.uxdsl`
// into an id Vite's own `CSS_LANGS_RE` recognizes as CSS (ending in `.css`,
// `?inline` preserved verbatim so Vite's *own* css plugin honors it exactly as
// it would for a real `.css?inline` import — this plugin does not special-case
// it). `load` calls `compile()` (the same pipeline the CLI and the Webpack
// loader use) and hands back plain CSS text; Vite's built-in
// `vite:css`/`vite:css-post` plugins take it from there — extraction in
// `vite build`, native HMR, and an empty/no-op SSR module, all for free.
//
// compile() runs Dart Sass itself, so there is no Sass pre-pass here: the
// `sass` option goes to compile(), which validates it and passes it to Dart
// Sass. Every file Dart Sass loaded is added with `addWatchFile`, and each
// compile() warning reaches `this.warn()` at its file (relative to Vite's
// root), line and column.
//
// A theme file that does not exist yet is watched for: with discovery on,
// `transform` adds each name it could have and no file has. `transform`, not
// `load`, because Rollup gives a transform's dependencies a watcher of their
// own, while the shared one reports only the first of several missing files
// in a directory under polling, on Linux and on Windows.
//
// A load that fails emits the warnings it produced, then adds with
// `addWatchFile` the module's own file, the files of its last successful load,
// the file the error names and the discovered theme file's require() tree,
// and rethrows the same error with `loc` (the file, line and column the error
// names) and `frame` (Dart Sass's for UXD_SASS, PostCSS's for a UXDSL error)
// set; its message is unchanged. An edit to any of those files starts a
// rebuild under `vite build --watch`. The dev server's HMR hooks
// (`hotUpdate` on Vite 6 and later, `handleHotUpdate` before) add the failed
// module to the update for an edit to one of them: a module Vite analyzed
// before gets its update, and one whose first load failed, which Vite never
// sends an update for, reloads the page through the modules that import it.
//
// There is no `breakpoints` option: breakpoints are a theme family — declared
// under `breakpoints` in the theme file (or the `theme` option), the one
// place every integration reads them from. There is no theme switch either:
// a module emits the theme when it reaches `@uxdsl theme;` (the app's global
// .uxdsl), and a component module carries only its own rules. A removed option
// is reported once per build, in `buildStart`, and never passed on.
//
// A build counts the theme over all its modules: `load` returns compile()'s
// `themeEmitted`, and whether the CSS references a --uxdsl__ token, as the
// module's meta, and `buildEnd` (in `vite build` and `vite build --watch`)
// reads it for every .uxdsl module, so no module reaching `@uxdsl theme;`
// while the CSS references tokens, or more than one module emitting the
// theme, is one UXD_THEME_MARKER warning per build. A failed build warns
// nothing. The dev server has no end of build: it never reports "none", and
// warns "more than one" when the set of emitting modules it has loaded
// changes.

export interface UxDslPluginOptions {
  /** Explicit theme override — skips discovery entirely when given. Its
   * `breakpoints` family is where thresholds are declared. */
  theme?: Record<string, unknown>;
  /** Same shape as the PostCSS plugin's `references` option. Always taken from
   * here (or left undefined): a theme file carries no references. */
  references?: Record<string, unknown>;
  /** When `theme` is omitted, discover the theme file (`THEME_CANDIDATES`
   * in `uxdsl/config`) from `configRoot` — the same discovery the CLI and the
   * PostCSS plugin used directly both do. Default
   * `true`. Set `false` to always validate against the built-in default
   * theme. */
  discoverTheme?: boolean;
  /** Directory theme discovery searches from. Defaults to Vite's resolved
   * project root (`config.root`), not `process.cwd()` — the two commonly
   * differ (a monorepo running Vite with a non-default `root`). */
  configRoot?: string;
  /** Passed to Dart Sass through compile(): the deprecation ids to silence
   * (each is reported as UXD_SASS_WARNING otherwise) and whether to silence
   * the deprecations of packages loaded from load paths or `pkg:`. compile()
   * validates it: any other key, or a value of the wrong type, fails the
   * load. */
  sass?: CompileConfig['sass'];
}

// A previously-resolved id of ours always carries this marker in its query
// string — distinguishes "a raw `./panel.uxdsl` specifier, resolve it" from
// "an id we already resolved, being asked about again" (Vite/Rollup can
// call resolveId more than once for the same final id).
const virtualMarkerRE = /[?&]uxdsl\b/;
// Vite's own inline-CSS marker (see vite/dist/node's `inlineRE`) — read
// here only to decide whether to preserve it into our virtual id; Vite's
// own `vite:css` plugin is what actually acts on it.
const inlineRE = /[?&]inline\b/;

function isVirtualId(id: string): boolean {
  return virtualMarkerRE.test(id);
}

function realPathFromVirtualId(id: string): string {
  const queryIndex = id.indexOf('?');
  return queryIndex === -1 ? id : id.slice(0, queryIndex);
}

/** A module as a warning names it: its file relative to `root`, `?inline` kept. */
function moduleLabel(id: string, root: string): string {
  return path.relative(root, realPathFromVirtualId(id)) + (inlineRE.test(id) ? '?inline' : '');
}

/** What load() records about the theme in a module's meta. */
type ThemeMeta = Pick<ThemeEmission, 'themeEmitted' | 'referencesTokens'>;

// Vite's CSS_LANGS_RE requires the extension immediately followed by `$`
// or `?` — `&lang.css` at the very end of the id satisfies that. `?uxdsl`
// is our own marker (see isVirtualId); `&inline` is preserved so Vite's
// *own* inlineRE still matches, letting its css plugin handle `?inline`
// exactly as it would for a real `.css?inline` import.
function buildVirtualId(absPath: string, inline: boolean): string {
  return `${absPath}?uxdsl${inline ? '&inline' : ''}&lang.css`;
}

// A compile() warning as one line, in the CLI's shape:
// `<file>:<line>:<column>: <text>` with the file relative to `root`,
// `<file>:<line>: <text>` without a column, `<file>: <text>` with a file only,
// and the text alone when the warning has no position (Dart Sass's
// `N repetitive deprecation warnings omitted.`, for one).
function formatWarning(warning: CompileWarning, root: string): string {
  if (!warning.file) return warning.text;
  const file = path.relative(root, warning.file);
  if (warning.line == null) return `${file}: ${warning.text}`;
  return `${file}:${warning.line}${warning.column != null ? `:${warning.column}` : ''}: ${warning.text}`;
}

// The discovered theme file and the local modules it requires, for a load
// that failed: compile() lists them only in a successful result. Empty when a
// `theme` option or `discoverTheme: false` turns discovery off, or when no
// theme file is found.
function themeFiles(options: UxDslPluginOptions, root: string): string[] {
  if (options.theme !== undefined || options.discoverTheme === false) return [];
  try {
    const file = findThemeConfigPath(root);
    return file ? [file, ...collectLocalRequireTree(file)] : [];
  } catch {
    return [];
  }
}

// The names a discovered theme file can have under `root` that no file has
// yet. A load adds each with `addWatchFile`, so the dev server and
// `vite build --watch` see one created (or one of a name that takes
// precedence) and load it. Empty when a `theme` option or
// `discoverTheme: false` turns discovery off.
function absentThemeFiles(options: UxDslPluginOptions, root: string): string[] {
  if (options.theme !== undefined || options.discoverTheme === false) return [];
  return absentThemeCandidatePaths(root);
}

const ANSI_RE = /\x1b\[[0-9;]*m/g;

// The frame of a failed compile: Dart Sass's own for UXD_SASS, PostCSS's
// (without color) for an error PostCSS raised, none otherwise.
function errorFrame(err: { code?: unknown; sassFrame?: unknown; showSourceCode?: unknown }): string {
  if (err.code === 'UXD_SASS' && typeof err.sassFrame === 'string' && err.sassFrame.trim()) return err.sassFrame;
  if (typeof err.showSourceCode === 'function') return String(err.showSourceCode(false)).replace(ANSI_RE, '');
  return '';
}

/** A file as Vite's HMR names it: absolute, with forward slashes. */
function hmrKey(file: string): string {
  return path.resolve(file).split(path.sep).join('/');
}

/** The part of a module node the HMR hooks read, in Vite 5's graph and in an environment's. */
interface HmrNode {
  isSelfAccepting?: boolean;
  importers: Set<HmrNode>;
}

export default function uxdsl(userOptions: UxDslPluginOptions = {}): Plugin {
  let projectRoot = process.cwd();
  // Follows Vite's own resolved sourcemap settings
  // rather than adding a plugin option that could disagree with them —
  // `build.sourcemap` for a build, `css.devSourcemap` for the dev server.
  let viteSourceMapEnabled = false;
  let command: ResolvedConfig['command'] = 'build';
  // The dev server: whether each module it loaded emitted the theme, and the
  // set of emitting modules it last warned about.
  const servedEmitting = new Map<string, boolean>();
  let servedWarning = '';
  // Each module's id and the files its last successful load added; and, in
  // the dev server, each file (as `hmrKey` writes it) and the ids of the
  // modules whose load failed and whose fix that file's edit may be.
  const lastGoodFiles = new Map<string, string[]>();
  const failedBy = new Map<string, Set<string>>();

  // The modules an edit to `file` adds to Vite's update: each failed module
  // Vite analyzed, and the importers of one it never analyzed (Vite reloads
  // the page for those). Undefined when the edit concerns no failed module.
  function failedModules<Node extends HmrNode>(file: string, current: Node[], byId: (id: string) => Node | undefined): Node[] | undefined {
    const ids = failedBy.get(hmrKey(file));
    if (!ids || ids.size === 0) return undefined;
    const added: Node[] = [];
    for (const id of ids) {
      const node = byId(id);
      if (!node) continue;
      if (node.isSelfAccepting === undefined) added.push(...(node.importers as Set<Node>));
      else added.push(node);
    }
    const fresh = added.filter((node, index) => !current.includes(node) && added.indexOf(node) === index);
    return fresh.length ? [...current, ...fresh] : undefined;
  }

  return {
    name: 'uxdsl',
    enforce: 'pre',
    configResolved(config: ResolvedConfig) {
      projectRoot = config.root || projectRoot;
      viteSourceMapEnabled = Boolean(config.build?.sourcemap) || Boolean(config.css?.devSourcemap);
      command = config.command;
    },
    // Once per build, and once per dev server.
    buildStart() {
      for (const text of removedOptionWarnings(userOptions)) this.warn(text);
    },
    resolveId(id: string, importer: string | undefined) {
      // A leading "/" is ambiguous on POSIX: `path.isAbsolute` can't tell
      // a real absolute filesystem path apart from Vite's own
      // root-relative id/URL form. Confirmed by reproducing under
      // `server.ssrLoadModule()`: Vite's SSR import rewriting round-trips
      // an id we already resolved through its dev-server URL space,
      // which strips the project-root prefix (but keeps our own query
      // string), then asks `resolveId` again with that root-relative
      // form — landing right back in the `isVirtualId` branch below. Both
      // branches here re-derive and verify a real absolute path instead
      // of ever trusting a leading "/" at face value.
      if (isVirtualId(id)) {
        const filePart = realPathFromVirtualId(id);
        if (path.isAbsolute(filePart) && fs.existsSync(filePart)) return id;
        const rebuiltAbs = path.resolve(projectRoot, filePart.replace(/^[/\\]/, ''));
        return fs.existsSync(rebuiltAbs) ? buildVirtualId(rebuiltAbs, inlineRE.test(id)) : null;
      }
      const queryIndex = id.indexOf('?');
      const rawPath = queryIndex === -1 ? id : id.slice(0, queryIndex);
      if (!rawPath.endsWith('.uxdsl')) return null;
      const absPath = path.isAbsolute(rawPath) && fs.existsSync(rawPath)
        ? rawPath
        : path.resolve(path.dirname(importer || projectRoot), rawPath);
      if (!fs.existsSync(absPath)) return null;
      return buildVirtualId(absPath, inlineRE.test(id));
    },
    async load(id: string) {
      if (!isVirtualId(id)) return null;
      const absPath = realPathFromVirtualId(id);

      // Vite drives maps from its own `build.sourcemap`
      // / `css.devSourcemap` settings, so this follows the resolved config
      // instead of inventing a plugin option. 'external' (never 'inline'):
      // the map is handed back as a real object for Vite to chain, and an
      // embedded data URI would instead bury it inside the CSS text where
      // Vite's own pipeline can't compose it.
      const wantMap = viteSourceMapEnabled;
      const { css, map, dependencies, warnings, themeEmitted } = await compile({ entry: absPath }, {
        // compile() discovers the theme file in this plugin's root (Vite's
        // `root` unless `configRoot` says otherwise) and lists it, with the
        // modules it requires, in `dependencies`.
        theme: userOptions.theme,
        discoverTheme: userOptions.discoverTheme,
        configRoot: userOptions.configRoot ?? projectRoot,
        references: userOptions.references,
        sourceMap: wantMap ? 'external' : false,
        to: absPath,
        sass: userOptions.sass,
      }).catch((error: unknown) => {
        // The warnings compile() produced before it failed come first. Then
        // the files whose edit can fix it, and the location; Rollup rewrites
        // the error's message, code and plugin after it is rethrown.
        for (const warning of (error as { warnings?: CompileWarning[] } | null)?.warnings ?? []) this.warn(formatWarning(warning, projectRoot));
        const failure = (error && typeof error === 'object' ? error : {}) as { file?: unknown; line?: unknown; column?: unknown; code?: unknown; sassFrame?: unknown; showSourceCode?: unknown; loc?: unknown; frame?: unknown };
        const errorFile = typeof failure.file === 'string' && path.isAbsolute(failure.file) ? failure.file : undefined;
        const files = new Set([absPath, ...(lastGoodFiles.get(id) ?? []), ...(errorFile ? [errorFile] : []), ...themeFiles(userOptions, userOptions.configRoot ?? projectRoot), ...absentThemeFiles(userOptions, userOptions.configRoot ?? projectRoot)]);
        for (const file of files) {
          this.addWatchFile(file);
          if (command !== 'serve') continue;
          const key = hmrKey(file);
          if (!failedBy.has(key)) failedBy.set(key, new Set());
          failedBy.get(key)!.add(id);
        }
        if (errorFile) {
          failure.loc = { file: errorFile, line: failure.line, column: failure.column };
          failure.frame = errorFrame(failure);
        }
        throw error;
      });

      for (const dep of dependencies) this.addWatchFile(dep);
      lastGoodFiles.set(id, dependencies);
      for (const [key, ids] of failedBy) {
        ids.delete(id);
        if (ids.size === 0) failedBy.delete(key);
      }
      for (const warning of warnings) this.warn(formatWarning(warning, projectRoot));

      if (command === 'serve') {
        servedEmitting.set(id, themeEmitted);
        for (const servedId of [...servedEmitting.keys()]) {
          if (!fs.existsSync(realPathFromVirtualId(servedId))) servedEmitting.delete(servedId);
        }
        const emitting = [...servedEmitting].filter(([, emitted]) => emitted).map(([servedId]) => moduleLabel(servedId, projectRoot)).sort();
        if (emitting.length < 2) servedWarning = '';
        else if (emitting.join('\n') !== servedWarning) {
          servedWarning = emitting.join('\n');
          const warning = themeEmissionWarning(emitting.map((label) => ({ label, themeEmitted: true, referencesTokens: true, canCarryTheme: true })), 'module');
          if (warning) this.warn(warning.text);
        }
      }

      // This is the map for the CSS this hook just produced. It is returned
      // as the module's own map only because the module *is* that CSS —
      // never as the map of a JavaScript module wrapping it.
      const meta: ThemeMeta = { themeEmitted, referencesTokens: referencesThemeTokens(css) };
      return { code: css, map: map ? JSON.parse(map) : null, meta: { uxdsl: meta } };
    },
    // The names the theme file can have and no file has yet, added from
    // `transform` and not from `load`: Rollup gives each file a transform
    // adds a watcher of its own, and the watcher all the other files share
    // reports, of several missing files in one directory, only the first
    // (where it does not use FSEvents: Linux, Windows, polling).
    transform(_code: string, id: string) {
      if (!isVirtualId(id)) return null;
      for (const file of absentThemeFiles(userOptions, userOptions.configRoot ?? projectRoot)) this.addWatchFile(file);
      return null;
    },
    // Vite 6 and later, per environment.
    hotUpdate(context) {
      const graph = this.environment.moduleGraph;
      return failedModules(context.file, context.modules, (id) => graph.getModuleById(id));
    },
    // Vite 4 and 5; Vite 6 and later call `hotUpdate` instead when a plugin has both.
    handleHotUpdate(context) {
      return failedModules(context.file, context.modules, (id) => context.server.moduleGraph.getModuleById(id));
    },
    // Once per `vite build` (and per rebuild in `--watch`), over every .uxdsl
    // module of the build. A module whose meta is missing makes the count
    // incomplete, and an incomplete count never reports "none".
    buildEnd(error?: Error) {
      if (error || command !== 'build') return;
      const sheets: ThemeEmission[] = [];
      let complete = true;
      for (const id of this.getModuleIds()) {
        if (!isVirtualId(id)) continue;
        const meta = this.getModuleInfo(id)?.meta?.uxdsl as ThemeMeta | undefined;
        if (meta) sheets.push({ label: moduleLabel(id, projectRoot), themeEmitted: meta.themeEmitted, referencesTokens: meta.referencesTokens, canCarryTheme: true });
        else complete = false;
      }
      sheets.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
      const warning = themeEmissionWarning(sheets, 'module', { complete });
      if (warning) this.warn(warning.text);
    },
  };
}

const cjsCompat = Object.assign(uxdsl, { default: uxdsl });
if (typeof module !== 'undefined') {
  module.exports = cjsCompat;
}
