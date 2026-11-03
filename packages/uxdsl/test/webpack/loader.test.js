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

const LOADER = path.resolve(__dirname, '..', '..', 'dist', 'webpack.js');
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

test('MIG-B6-20: loader options arrive via getOptions(), not the removed this.query — breakpoints through the theme option', async () => {
  const dir = mkTmpDir();
  write(dir, 'panel.uxdsl', '.a { padding: xs(1rem) md(2rem); }');
  const entry = write(dir, 'entry.js', "import './panel.uxdsl';");

  // Stability phase 2: there is no `breakpoints` loader option; thresholds
  // are the theme's own `breakpoints` family, here through the explicit
  // `theme` option (a discovered theme file works the same way).
  await runWebpack({
    mode: 'development',
    context: dir,
    entry,
    output: { path: path.join(dir, 'dist'), filename: 'bundle.js' },
    module: {
      rules: [{
        test: /\.uxdsl$/,
        use: [STYLE_LOADER, CSS_LOADER, { loader: LOADER, options: { includeTheme: false, theme: { breakpoints: { xs: 0, md: 900 } } } }],
      }],
    },
  });

  const bundle = fs.readFileSync(path.join(dir, 'dist/bundle.js'), 'utf8');
  assert.match(bundle, /900px/);
  assert.doesNotMatch(bundle, /768px/);
});

test('MIG-B6-20: discovers uxdsl.theme.cjs from rootContext when theme is omitted', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.cjs', "module.exports = { palette: { webpackonlybrand: { main: '#0af', dark: '#048', contrast: '#fff' } } };");
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
  write(dir, 'uxdsl.theme.cjs', "module.exports = { palette: { webpackonlybrand: { main: '#0af', dark: '#048', contrast: '#fff' } } };");
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
  }), /UXD_PALETTE_REFERENCE/);
});

// --- Dart Sass through compile(): what Sass loaded, watch, the sass option, located warnings ---

const IMPORT_DEPRECATION = 'UXD_SASS_WARNING: [import] Sass @import rules are deprecated and will be removed in Dart Sass 3.0.0.';

// styles/panel.uxdsl @uses a partial that @imports another: Dart Sass loads
// three files and reports one deprecation, at _partial.uxdsl:1:9.
function sassProject() {
  const dir = mkTmpDir();
  const partial = write(dir, 'styles/_partial.uxdsl', "@import './legacy';\n.partial { color: green; }\n");
  const legacy = write(dir, 'styles/_legacy.uxdsl', '.legacy { color: olive; }\n');
  write(dir, 'styles/panel.uxdsl', "@use './partial';\n.panel { color: red; }\n");
  const entry = write(dir, 'entry.js', "import './styles/panel.uxdsl';");
  return { dir, entry, partial, legacy };
}

function sassConfig(dir, entry, loaderOptions) {
  return {
    mode: 'development',
    context: dir,
    entry,
    output: { path: path.join(dir, 'dist'), filename: 'bundle.js' },
    module: { rules: [{ test: /\.uxdsl$/, use: [STYLE_LOADER, CSS_LOADER, { loader: LOADER, options: { includeTheme: false, ...loaderOptions } }] }] },
  };
}

// The text the loader emitted, without the "Module Warning (from <loader>):"
// line webpack puts before it.
function loaderWarnings(stats) {
  return stats.compilation.warnings.map((warning) => warning.message.slice(warning.message.indexOf('\n') + 1));
}

// compiler.watch(), one build at a time: each call resolves with the next
// build's stats. The watcher is closed when the test ends.
function watchBuilds(t, config) {
  const ready = [];
  const waiting = [];
  const watching = webpack(config).watch({ aggregateTimeout: 50 }, (err, stats) => {
    const build = { err, stats };
    const next = waiting.shift();
    if (next) next(build); else ready.push(build);
  });
  t.after(() => new Promise((resolve) => watching.close(() => resolve())));
  return () => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for a webpack build')), 20000);
    const deliver = ({ err, stats }) => {
      clearTimeout(timer);
      if (err) return reject(err);
      if (stats.hasErrors()) return reject(new Error(stats.toString({ colors: false })));
      resolve(stats);
    };
    const build = ready.shift();
    if (build) deliver(build); else waiting.push(deliver);
  });
}

test("MIG-B9-14: a @use'd partial is a dependency and a change to it recompiles", async (t) => {
  const { dir, entry, partial, legacy } = sassProject();
  // Files written just before the watcher starts can look changed to it and
  // trigger one more build; dating them ten seconds back avoids that.
  const past = new Date(Date.now() - 10000);
  for (const file of [partial, legacy, path.join(dir, 'styles/panel.uxdsl'), entry]) fs.utimesSync(file, past, past);
  const nextBuild = watchBuilds(t, sassConfig(dir, entry, {}));

  const first = await nextBuild();
  const fileDependencies = [...first.compilation.fileDependencies].map((file) => path.resolve(file));
  assert.ok(fileDependencies.includes(path.resolve(partial)), 'the @use\'d partial is a webpack file dependency');
  assert.ok(fileDependencies.includes(path.resolve(legacy)), 'and so is the file it @imports');
  assert.match(fs.readFileSync(path.join(dir, 'dist/bundle.js'), 'utf8'), /\.partial \{[^}]*color: green;/);

  // Each warning is emitted at its file, relative to webpack's rootContext,
  // and at its line and column.
  assert.deepEqual(loaderWarnings(first), [`${path.join('styles', '_partial.uxdsl')}:1:9: ${IMPORT_DEPRECATION}`]);

  // Give the watcher a moment to start, then edit the partial: webpack
  // rebuilds with the new value. A build that started before the edit
  // landed may still carry the old one, so wait for the build that has it;
  // each wait times out after 20 s.
  await new Promise((resolve) => setTimeout(resolve, 300));
  fs.writeFileSync(partial, "@import './legacy';\n.partial { color: teal; }\n");
  const bundlePath = path.join(dir, 'dist/bundle.js');
  let rebuilt;
  do {
    rebuilt = await nextBuild();
  } while (!/color: teal/.test(fs.readFileSync(bundlePath, 'utf8')));
  const bundle = fs.readFileSync(bundlePath, 'utf8');
  assert.match(bundle, /\.partial \{[^}]*color: teal;/);
  assert.doesNotMatch(bundle, /color: green/);
  assert.deepEqual(loaderWarnings(rebuilt), [`${path.join('styles', '_partial.uxdsl')}:1:9: ${IMPORT_DEPRECATION}`]);
});

test('MIG-B9-14: the loader passes its sass option to compile(): silenceDeprecations removes a deprecation, an unknown key fails the module', async () => {
  const { dir, entry } = sassProject();

  // Negative control: without the option the deprecation is there, so its
  // absence below comes from the option.
  const plain = await runWebpack(sassConfig(dir, entry, {}));
  assert.equal(loaderWarnings(plain).length, 1, JSON.stringify(loaderWarnings(plain)));

  const silenced = await runWebpack(sassConfig(dir, entry, { sass: { silenceDeprecations: ['import'] } }));
  assert.deepEqual(loaderWarnings(silenced), []);

  await runWebpack(sassConfig(dir, entry, { sass: { quietDeps: true } }));

  // compile() validates the option: an unknown key fails the module with its message.
  await assert.rejects(runWebpack(sassConfig(dir, entry, { sass: { bogus: 1 } })), /unknown sass option "bogus"/);
  await assert.rejects(runWebpack(sassConfig(dir, entry, { sass: { quietDeps: 'yes' } })), /sass\.quietDeps must be a boolean/);
});

test('phase 2: a theme file exporting { theme, references } fails the compilation with the loader\'s own message', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.cjs', "module.exports = { theme: {}, references: { externalTokens: ['--x'] } };");
  write(dir, 'panel.uxdsl', '.a { color: red; }');
  const entry = write(dir, 'entry.js', "import './panel.uxdsl';");
  await assert.rejects(runWebpack({
    mode: 'development',
    context: dir,
    entry,
    output: { path: path.join(dir, 'dist'), filename: 'bundle.js' },
    module: { rules: [{ test: /\.uxdsl$/, use: [STYLE_LOADER, CSS_LOADER, LOADER] }] },
  }), /That wrapper was removed/);
});
