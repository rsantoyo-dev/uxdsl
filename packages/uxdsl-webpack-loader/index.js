'use strict';

// MIG-B6-20 (FEAT-008): rewritten on top of uxdsl-core's compile() — the
// same pipeline the CLI and Vite plugin use, so the same entry and theme
// produce the same CSS everywhere (D-4). Fixes three real bugs in the
// previous 15-line implementation:
//   - `this.query` (a raw, possibly-string query) is replaced by
//     `this.getOptions()`, webpack 5's real options API.
//   - `this.addDependency()` is now called for every file compile()
//     reports (the entry plus every transitively @import-ed partial, and
//     the discovered theme file's own require() tree), so webpack's cache
//     and watch mode actually see an edit to a partial or the theme.
//   - `module.exports = ${JSON.stringify(css)}` returned a JS string
//     module, which css-loader cannot consume as CSS at all (it expects
//     real CSS text) — this now returns the compiled CSS text itself, so
//     `use: ['style-loader', 'css-loader', 'uxdsl-webpack-loader']` (or
//     MiniCssExtractPlugin in place of style-loader) works as documented.
const core = require('uxdsl-core');
const config = require('postcss-uxdsl/config');

module.exports = async function uxdslLoader(source) {
  const callback = this.async();
  try {
    const options = this.getOptions() || {};
    const configRoot = options.configRoot || this.rootContext;
    const discoverTheme = options.discoverTheme !== false;

    // Same authoritative-discovery rule as the Vite plugin: resolve theme
    // exactly once here (the one place that knows the real project root),
    // and always hand compile() a defined `theme` (`{}` when nothing was
    // found/enabled) so the plugin's own MIG-B6-19 auto-discovery — which
    // only knows `process.cwd()`, not webpack's `rootContext` — never
    // second-guesses it.
    let discovered = null;
    if (options.theme === undefined && discoverTheme) {
      discovered = await config.discoverThemeAsync(configRoot);
    }
    const theme = options.theme !== undefined
      ? options.theme
      : (discoverTheme ? (discovered ? discovered.theme : {}) : {});
    const references = options.references !== undefined ? options.references : (discovered ? discovered.references : undefined);

    // MIG-B6-21 (FEAT-008): webpack sets `this.sourceMap` from the
    // compilation's own devtool setting, so maps follow the project's
    // configuration by default rather than needing loader options of their
    // own; `options.sourceMap` overrides it explicitly either way. Always
    // 'external' here: webpack wants the map as a separate object, and
    // embedding a data URI in the CSS would hide it from the next loader
    // in the chain (css-loader) instead of letting it compose.
    const wantMap = options.sourceMap !== undefined ? options.sourceMap !== false : this.sourceMap === true;

    const { css, map, dependencies, warnings } = await core.compile(
      { source, from: this.resourcePath },
      {
        theme,
        references,
        breakpoints: options.breakpoints,
        includeTheme: options.includeTheme,
        sourceMap: wantMap ? 'external' : false,
        to: this.resourcePath,
      }
    );

    for (const dep of dependencies) this.addDependency(dep);
    if (discovered) for (const dep of discovered.dependencies) this.addDependency(dep);
    for (const warning of warnings) this.emitWarning(new Error(warning.text));

    // The loader contract wants a map *object*, not the JSON string
    // compile() returns — passing the string through makes the next loader
    // silently drop it, which looks like "no map support" rather than a
    // type mismatch.
    callback(null, css, map ? JSON.parse(map) : undefined);
  } catch (err) {
    callback(err);
  }
};
