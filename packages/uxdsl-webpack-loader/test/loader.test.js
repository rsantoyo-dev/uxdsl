'use strict';

// MIG-B6-20 (FEAT-008): real webpack compilations, not a mocked loader
// context — this is what actually catches "this.query is undefined under
// webpack 5" or "css-loader can't parse a JS string module" class bugs,
// which a hand-rolled `{ async: () => ... }` stub would not.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const LOADER = path.resolve(__dirname, '..', 'index.js');
const STYLE_LOADER = require.resolve('style-loader');
const CSS_LOADER = require.resolve('css-loader');

function mkTmpDir() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-webpack-loader-test-')));
}

function write(dir, relPath, content) {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

function runWebpack(config) {
  return new Promise((resolve, reject) => {
    webpack(config, (err, stats) => {
      if (err) return reject(err);
      if (stats.hasErrors()) return reject(new Error(stats.toString({ colors: false })));
      resolve(stats);
    });
  });
}

test('MIG-B6-20: style-loader + css-loader + uxdsl-webpack-loader compiles a real bundle with resolved CSS', async () => {
  const dir = mkTmpDir();
  write(dir, 'panel.uxdsl', '.a { color: red; padding: xs(1rem) md(2rem); }');
  const entry = write(dir, 'entry.js', "import './panel.uxdsl';");

  await runWebpack({
    mode: 'development',
    context: dir,
    entry,
    output: { path: path.join(dir, 'dist'), filename: 'bundle.js' },
    module: { rules: [{ test: /\.uxdsl$/, use: [STYLE_LOADER, CSS_LOADER, LOADER] }] },
  });

  const bundle = fs.readFileSync(path.join(dir, 'dist/bundle.js'), 'utf8');
  assert.match(bundle, /1rem/);
  assert.match(bundle, /768px/);
});

test('MIG-B6-20: chains with MiniCssExtractPlugin, producing a real extracted .css file (not just style-loader\'s runtime injection)', async () => {
  const dir = mkTmpDir();
  write(dir, 'panel.uxdsl', '.a { color: blue; }');
  const entry = write(dir, 'entry.js', "import './panel.uxdsl';");

  await runWebpack({
    mode: 'production',
    context: dir,
    entry,
    output: { path: path.join(dir, 'dist'), filename: 'bundle.js' },
    module: { rules: [{ test: /\.uxdsl$/, use: [MiniCssExtractPlugin.loader, CSS_LOADER, LOADER] }] },
    plugins: [new MiniCssExtractPlugin({ filename: 'styles.css' })],
    optimization: { minimize: false },
  });

  const cssPath = path.join(dir, 'dist/styles.css');
  assert.ok(fs.existsSync(cssPath), 'MiniCssExtractPlugin should have written dist/styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(css, /\.a\s*\{[^}]*color:\s*blue/);
});

test('MIG-B6-20: this.addDependency() registers an @import-ed partial, so watch mode recompiles when it changes', async () => {
  const dir = mkTmpDir();
  const partial = write(dir, 'partial.uxdsl', '.partial { color: green; }');
  write(dir, 'panel.uxdsl', '@import "./partial.uxdsl";\n.a { color: red; }');
  const entry = write(dir, 'entry.js', "import './panel.uxdsl';");

  const stats = await runWebpack({
    mode: 'development',
    context: dir,
    entry,
    output: { path: path.join(dir, 'dist'), filename: 'bundle.js' },
    module: { rules: [{ test: /\.uxdsl$/, use: [STYLE_LOADER, CSS_LOADER, LOADER] }] },
  });

  const fileDependencies = [...stats.compilation.fileDependencies];
  assert.ok(
    fileDependencies.some((f) => path.resolve(f) === path.resolve(partial)),
    'the imported partial must be a registered webpack file dependency'
  );
});

test('MIG-B6-20: loader options arrive via getOptions() (breakpoints), not the removed this.query', async () => {
  const dir = mkTmpDir();
  write(dir, 'panel.uxdsl', '.a { padding: xs(1rem) md(2rem); }');
  const entry = write(dir, 'entry.js', "import './panel.uxdsl';");

  // includeTheme: false — a partial breakpoints override otherwise also
  // has to cover every name the default theme's own foundational CSS
  // (edges/shadows/etc.) references; irrelevant to what this test checks.
  await runWebpack({
    mode: 'development',
    context: dir,
    entry,
    output: { path: path.join(dir, 'dist'), filename: 'bundle.js' },
    module: {
      rules: [{
        test: /\.uxdsl$/,
        use: [STYLE_LOADER, CSS_LOADER, { loader: LOADER, options: { includeTheme: false, breakpoints: { xs: 0, md: 900 } } }],
      }],
    },
  });

  const bundle = fs.readFileSync(path.join(dir, 'dist/bundle.js'), 'utf8');
  assert.match(bundle, /900px/);
  assert.doesNotMatch(bundle, /768px/);
});

test('MIG-B6-20: discovers uxdsl.theme.config.cjs from rootContext when theme is omitted', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.config.cjs', "module.exports = { theme: { palette: { webpackonlybrand: { main: '#0af', dark: '#048', contrast: '#fff' } } } };");
  write(dir, 'panel.uxdsl', '.a { color: palette(webpackonlybrand); }');
  const entry = write(dir, 'entry.js', "import './panel.uxdsl';");

  await runWebpack({
    mode: 'development',
    context: dir,
    entry,
    output: { path: path.join(dir, 'dist'), filename: 'bundle.js' },
    module: { rules: [{ test: /\.uxdsl$/, use: [STYLE_LOADER, CSS_LOADER, LOADER] }] },
  });

  const bundle = fs.readFileSync(path.join(dir, 'dist/bundle.js'), 'utf8');
  assert.match(bundle, /--uxdsl__palette__webpackonlybrand-main/);
});

test('MIG-B6-20: discoverTheme: false keeps validating against the built-in default theme', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.config.cjs', "module.exports = { theme: { palette: { webpackonlybrand: { main: '#0af', dark: '#048', contrast: '#fff' } } } };");
  write(dir, 'panel.uxdsl', '.a { color: palette(webpackonlybrand); }');
  const entry = write(dir, 'entry.js', "import './panel.uxdsl';");

  await assert.rejects(runWebpack({
    mode: 'development',
    context: dir,
    entry,
    output: { path: path.join(dir, 'dist'), filename: 'bundle.js' },
    module: {
      rules: [{
        test: /\.uxdsl$/,
        use: [STYLE_LOADER, CSS_LOADER, { loader: LOADER, options: { discoverTheme: false } }],
      }],
    },
  }), /UXD_REFERENCE_MISSING/);
});
