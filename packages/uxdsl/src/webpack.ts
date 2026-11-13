// The Webpack loader: `compile()` — the same pipeline the CLI and the Vite
// plugin use, so the same entry and theme produce the same CSS everywhere —
// returning plain CSS text for css-loader. Options come from
// `this.getOptions()`; every file `compile()` reports (the entry, each file
// Dart Sass loaded through `@use`, `@forward` or `@import`, the discovered
// theme file's own require() tree) is added with `this.addDependency()`, so
// webpack's cache and watch mode see an edit to any of them. Each compile()
// warning is emitted with `this.emitWarning()` at its file (relative to
// `rootContext`), line and column. The map goes to the next loader with
// absolute paths as its sources. Use it as
// `use: ['style-loader', 'css-loader', 'uxdsl/webpack']` (or
// MiniCssExtractPlugin's loader in place of style-loader). There is no theme
// switch: a module emits the theme when it reaches `@uxdsl theme;` (the app's
// global .uxdsl), and a component module carries only its own rules. A removed
// option is reported once per compilation and never passed on.
//
// A compilation counts the theme over every module this loader is in the
// chain of: each build records what compile() said (`themeEmitted`, whether
// the CSS references a --uxdsl__ token, whether the module may carry the
// theme — a `*.module.uxdsl` is a CSS Module and cannot) on the module's
// buildInfo, and on the module that issued it when that one has the same
// resource (the outer module mini-css-extract-plugin's and style-loader's
// pitching loaders build), so a module webpack keeps from an earlier build or
// restores from its persistent cache still counts. At the compilation's
// finishModules, no module reaching `@uxdsl theme;` while the CSS references
// tokens, or more than one module emitting the theme, is one UXD_THEME_MARKER
// warning. Where the loader cannot see webpack's compiler (a bare loader
// runner, thread-loader) or runs in a child compiler, and in a compiler it has
// not run in yet (a new process whose persistent cache restored every .uxdsl
// module), it checks nothing: it never guesses.
import fs from 'fs';
import path from 'path';
import { compile, referencesThemeTokens, themeEmissionWarning } from './compile';
import type { CompileConfig, CompileWarning, ThemeEmission } from './compile';
import { discoverThemeAsync, removedOptionWarnings } from './config';

/** Loader options: the same theme options as the PostCSS plugin and the Vite
 * plugin, plus `sourceMap` (defaults to webpack's own `this.sourceMap`) and
 * `sass`. */
interface UxdslLoaderOptions {
  theme?: Record<string, unknown>;
  references?: Record<string, unknown>;
  discoverTheme?: boolean;
  configRoot?: string;
  sourceMap?: boolean;
  /** Passed to Dart Sass through compile(): the deprecation ids to silence
   * (each is reported as UXD_SASS_WARNING otherwise) and whether to silence
   * the deprecations of packages loaded from load paths or `pkg:`. compile()
   * validates it: any other key, or a value of the wrong type, fails the
   * module. */
  sass?: CompileConfig['sass'];
}

/** The part of webpack's loader context this loader uses. */
interface LoaderContext {
  async(): (error: unknown, content?: string, map?: unknown) => void;
  getOptions(): UxdslLoaderOptions | undefined;
  addDependency(file: string): void;
  emitWarning(warning: Error): void;
  rootContext: string;
  resourcePath: string;
  sourceMap?: boolean;
  /** Webpack's compiler, compilation and module this module is built by; absent under a bare loader runner. */
  _compiler?: WebpackCompiler;
  _compilation?: WebpackCompilation;
  _module?: WebpackModule;
}

/** The parts of webpack's own objects the theme count reads. */
interface WebpackModule {
  buildInfo?: Record<string, unknown>;
  resource?: string;
  loaders?: Array<{ loader: string }>;
}
interface WebpackCompilation {
  compiler: WebpackCompiler;
  warnings: Error[];
  moduleGraph?: { getIssuer(module: WebpackModule): WebpackModule | null | undefined };
  hooks: { finishModules: { tap(name: string, fn: (modules: Iterable<WebpackModule>) => void): void } };
}
interface WebpackCompiler {
  context: string;
  isChild(): boolean;
  webpack?: { WebpackError: new (message: string) => Error };
  hooks: { thisCompilation: { tap(name: string, fn: (compilation: WebpackCompilation) => void): void } };
}

/** What a module's build said about the theme, on its buildInfo. */
type ThemeFlags = Omit<ThemeEmission, 'label'>;
const BUILD_INFO_KEY = 'uxdslTheme';

/** Compilations already told about the removed options the loader was given. */
const toldCompilations = new WeakSet<object>();
/** Compilers whose every compilation counts the theme at finishModules. */
const countingCompilers = new WeakSet<object>();

const realPaths = new Map<string, string>();
function realPath(file: string): string {
  let real = realPaths.get(file);
  if (real === undefined) {
    try { real = fs.realpathSync(file); } catch { real = file; }
    realPaths.set(file, real);
  }
  return real;
}

/** Whether `loader`, as a module's `loaders` names it, is this file. */
function isThisLoader(loader: string): boolean {
  return realPath(loader) === realPath(__filename);
}

/** At `compilation`'s finishModules: the one UXD_THEME_MARKER warning over every module this loader built, rebuilt or kept. */
function countThemeAtFinishModules(compilation: WebpackCompilation): void {
  compilation.hooks.finishModules.tap('uxdsl', (modules) => {
    // Every stylesheet, by resource: what its last build said, or null when no
    // module of it carries that (webpack restored it without the flags).
    const byResource = new Map<string, ThemeFlags | null>();
    for (const module of modules) {
      if (!module.resource || !module.loaders?.some((entry) => isThisLoader(entry.loader))) continue;
      const flags = module.buildInfo?.[BUILD_INFO_KEY] as ThemeFlags | undefined;
      if (flags) byResource.set(module.resource, flags);
      else if (!byResource.has(module.resource)) byResource.set(module.resource, null);
    }
    const context = compilation.compiler.context;
    const sheets: ThemeEmission[] = [];
    for (const [resource, flags] of byResource) if (flags) sheets.push({ label: path.relative(context, resource), ...flags });
    sheets.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
    const complete = [...byResource.values()].every((flags) => flags !== null);
    const warning = themeEmissionWarning(sheets, 'module', { complete });
    if (!warning) return;
    const WebpackError = compilation.compiler.webpack?.WebpackError || Error;
    compilation.warnings.push(new WebpackError(warning.text));
  });
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

// compile()'s map names each file by a URL relative to the module's
// directory. The next loader receives every such source as an absolute path
// (`<css input>` and `<no source>` stay as they are), as sass-loader and
// postcss-loader hand theirs: css-loader resolves a relative source against
// the working directory, not against the module, and would then name the
// wrong file in the map webpack emits.
function withAbsoluteSources(map: { sources: string[] }, resourcePath: string): { sources: string[] } {
  const dir = path.dirname(resourcePath);
  return { ...map, sources: map.sources.map((source) => (source.startsWith('<') ? source : path.resolve(dir, decodeURIComponent(source)))) };
}

async function uxdslLoader(this: LoaderContext, source: string): Promise<void> {
  const callback = this.async();
  try {
    const options = this.getOptions() || {};
    // Once per compilation (every module of it shares the options); once per
    // call where there is no compilation to remember.
    const compilation = this._compilation;
    if (!compilation || !toldCompilations.has(compilation)) {
      if (compilation) toldCompilations.add(compilation);
      for (const text of removedOptionWarnings(options)) this.emitWarning(new Error(text));
    }
    // The first module of the first compilation this loader runs in counts this
    // compilation and every later one of its compiler.
    const compiler = this._compiler;
    if (compiler && compilation && !compiler.isChild() && !countingCompilers.has(compiler)) {
      countingCompilers.add(compiler);
      countThemeAtFinishModules(compilation);
      compiler.hooks.thisCompilation.tap('uxdsl', countThemeAtFinishModules);
    }
    const configRoot = options.configRoot || this.rootContext;
    const discoverTheme = options.discoverTheme !== false;

    // Same discovery rule as the Vite plugin: resolve the theme exactly once
    // here (the one place that knows the real project root), and always hand
    // compile() a defined `theme` (`{}` when nothing was found/enabled) so
    // the PostCSS plugin's own discovery — which only knows `process.cwd()`,
    // not webpack's `rootContext` — never second-guesses it.
    let discovered: Awaited<ReturnType<typeof discoverThemeAsync>> = null;
    if (options.theme === undefined && discoverTheme) {
      discovered = await discoverThemeAsync(configRoot);
    }
    const theme = options.theme !== undefined
      ? options.theme
      : (discoverTheme ? (discovered ? discovered.theme : {}) : {});
    // A theme file carries no `references`: they come from
    // the loader options or nowhere. Breakpoints are the theme's `breakpoints`
    // family; there is no loader option for them.
    const references = options.references;

    // Webpack sets `this.sourceMap` from the
    // compilation's own devtool setting, so maps follow the project's
    // configuration by default rather than needing loader options of their
    // own; `options.sourceMap` overrides it explicitly either way. Always
    // 'external' here: webpack wants the map as a separate object, and
    // embedding a data URI in the CSS would hide it from the next loader
    // in the chain (css-loader) instead of letting it compose.
    const wantMap = options.sourceMap !== undefined ? options.sourceMap !== false : this.sourceMap === true;

    const { css, map, dependencies, warnings, themeEmitted } = await compile(
      { source, from: this.resourcePath },
      {
        theme: theme as Record<string, unknown>,
        references,
        sourceMap: wantMap ? 'external' : false,
        to: this.resourcePath,
        sass: options.sass,
      }
    );

    const module = this._module;
    if (module?.buildInfo) {
      const flags: ThemeFlags = { themeEmitted, referencesTokens: referencesThemeTokens(css), canCarryTheme: !/\.module\.uxdsl$/i.test(this.resourcePath) };
      module.buildInfo[BUILD_INFO_KEY] = flags;
      const issuer = compilation?.moduleGraph?.getIssuer(module);
      if (issuer?.buildInfo && issuer.resource === module.resource) issuer.buildInfo[BUILD_INFO_KEY] = flags;
    }

    for (const dep of dependencies) this.addDependency(dep);
    if (discovered) for (const dep of discovered.dependencies) this.addDependency(dep);
    for (const warning of warnings) this.emitWarning(new Error(formatWarning(warning, this.rootContext)));

    // The loader contract wants a map *object*, not the JSON string
    // compile() returns — passing the string through makes the next loader
    // silently drop it, which looks like "no map support" rather than a
    // type mismatch.
    callback(null, css, map ? withAbsoluteSources(JSON.parse(map), this.resourcePath) : undefined);
  } catch (err) {
    callback(err);
  }
}

export = uxdslLoader;
