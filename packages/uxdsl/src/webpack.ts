// The Webpack loader: `compile()` — the same pipeline the CLI and the Vite
// plugin use, so the same entry and theme produce the same CSS everywhere —
// returning plain CSS text for css-loader. Options come from
// `this.getOptions()`; every file `compile()` reports (the entry, each file
// Dart Sass loaded through `@use`, `@forward` or `@import`, the discovered
// theme file's own require() tree) is added with `this.addDependency()`, so
// webpack's cache and watch mode see an edit to any of them. Each compile()
// warning is emitted with `this.emitWarning()` at its file (relative to
// `rootContext`), line and column. Use it as
// `use: ['style-loader', 'css-loader', 'uxdsl/webpack']` (or
// MiniCssExtractPlugin's loader in place of style-loader).
import path from 'path';
import { compile } from './compile';
import type { CompileConfig, CompileWarning } from './compile';
import { discoverThemeAsync } from './config';

/** Loader options: the same theme options as the PostCSS plugin and the Vite
 * plugin, plus `sourceMap` (defaults to webpack's own `this.sourceMap`) and
 * `sass`. */
interface UxdslLoaderOptions {
  theme?: Record<string, unknown>;
  references?: Record<string, unknown>;
  includeTheme?: boolean;
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

async function uxdslLoader(this: LoaderContext, source: string): Promise<void> {
  const callback = this.async();
  try {
    const options = this.getOptions() || {};
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

    const { css, map, dependencies, warnings } = await compile(
      { source, from: this.resourcePath },
      {
        theme: theme as Record<string, unknown>,
        references,
        includeTheme: options.includeTheme,
        sourceMap: wantMap ? 'external' : false,
        to: this.resourcePath,
        sass: options.sass,
      }
    );

    for (const dep of dependencies) this.addDependency(dep);
    if (discovered) for (const dep of discovered.dependencies) this.addDependency(dep);
    for (const warning of warnings) this.emitWarning(new Error(formatWarning(warning, this.rootContext)));

    // The loader contract wants a map *object*, not the JSON string
    // compile() returns — passing the string through makes the next loader
    // silently drop it, which looks like "no map support" rather than a
    // type mismatch.
    callback(null, css, map ? JSON.parse(map) : undefined);
  } catch (err) {
    callback(err);
  }
}

export = uxdslLoader;
