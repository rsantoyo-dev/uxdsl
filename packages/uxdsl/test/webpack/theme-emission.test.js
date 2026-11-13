'use strict';

// The webpack loader counts the theme over every .uxdsl module of a
// compilation: it records what each module's compile() said
// (`themeEmitted`, whether its CSS references a --uxdsl__ token) on the
// module's buildInfo, and on the module that issued it when that one has the
// same resource (the outer module mini-css-extract-plugin and style-loader
// build), and at the compilation's finishModules reads it from every module
// in the loader's chain, rebuilt or kept from an earlier build or from the
// persistent cache. No module reaching `@uxdsl theme;` while the CSS
// references tokens, or more than one module emitting the theme, is one
// UXD_THEME_MARKER warning per compilation. Real webpack compilations.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const DIST = path.resolve(__dirname, '..', '..', 'dist');
const LOADER = path.join(DIST, 'webpack.js');
const STYLE_LOADER = require.resolve('style-loader');
const CSS_LOADER = require.resolve('css-loader');
const { themeEmissionWarning } = require('../../dist/compile');

const TOKENS = '.a { padding: density(4); color: palette(primary.main); }\n';
const NONE = themeEmissionWarning([{ label: 'a.uxdsl', themeEmitted: false, referencesTokens: true, canCarryTheme: true }], 'module').text;
const many = (labels) => themeEmissionWarning(labels.map((label) => ({ label, themeEmitted: true, referencesTokens: true, canCarryTheme: true })), 'module').text;

function project(t, files) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-webpack-theme-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  }
  // Older than the compiler's start, so a watching compiler does not rebuild them at once.
  const past = (Date.now() - 10000) / 1000;
  for (const file of Object.keys(files)) fs.utimesSync(path.join(dir, file), past, past);
  return dir;
}

/** A compiler's configuration: MiniCssExtractPlugin in production (`extract`), or style-loader in development. */
function config(dir, { extract = true, loader = LOADER, cache, mini = {}, entry = 'entry.js' } = {}) {
  return {
    mode: extract ? 'production' : 'development',
    context: dir,
    entry: path.join(dir, entry),
    output: { path: path.join(dir, 'dist') },
    devtool: false,
    module: { rules: [{ test: /\.uxdsl$/, use: [extract ? MiniCssExtractPlugin.loader : STYLE_LOADER, CSS_LOADER, { loader, options: { discoverTheme: false } }] }] },
    plugins: extract ? [new MiniCssExtractPlugin({ filename: 'styles.css', ...mini })] : [],
    optimization: { minimize: false },
    infrastructureLogging: { level: 'none' },
    ...(cache ? { cache } : {}),
  };
}

const themeWarnings = (stats) => stats.compilation.warnings.map((warning) => String(warning.message)).filter((message) => /UXD_THEME_MARKER/.test(message));

function run(cfg) {
  return new Promise((resolve, reject) => {
    const compiler = webpack(cfg);
    compiler.run((error, stats) => {
      if (error) return reject(error);
      compiler.close(() => (stats.hasErrors() ? reject(new Error(stats.toString({ colors: false }))) : resolve(stats)));
    });
  });
}

const THREE = { 'entry.js': "import './global.uxdsl';\nimport './a.uxdsl';\nimport './b.uxdsl';\n", 'global.uxdsl': '@uxdsl theme;\n', 'a.uxdsl': TOKENS, 'b.uxdsl': '.b { margin: space(2); }\n' };

for (const extract of [true, false]) {
  const how = extract ? 'MiniCssExtractPlugin, production' : 'style-loader, development';
  test(`MIG-B9-20: webpack warns UXD_THEME_MARKER once per compilation over every .uxdsl module (${how})`, async (t) => {
    assert.deepEqual(themeWarnings(await run(config(project(t, THREE), { extract }))), [], 'one global with the marker');
    assert.deepEqual(themeWarnings(await run(config(project(t, { ...THREE, 'global.uxdsl': '/* no marker */\n' }), { extract }))), [NONE], 'none, though two modules read tokens');
    const shared = { 'entry.js': "import './a.uxdsl';\nimport './b.uxdsl';\n", '_theme.uxdsl': '@uxdsl theme;\n', 'a.uxdsl': `@use './theme';\n${TOKENS}`, 'b.uxdsl': "@use './theme';\n.b { margin: space(2); }\n" };
    assert.deepEqual(themeWarnings(await run(config(project(t, shared), { extract }))), [many(['a.uxdsl', 'b.uxdsl'])], 'a partial with the marker, @use-d by two modules');
    // Negative control: plain CSS needs no theme.
    assert.deepEqual(themeWarnings(await run(config(project(t, { 'entry.js': "import './a.uxdsl';\n", 'a.uxdsl': '.a { color: red; }\n' }), { extract }))), []);
  });
}

test('MIG-B9-20: a webpack build of only *.module.uxdsl modules is silent; one non-module .uxdsl without the marker warns', async (t) => {
  const modules = { 'entry.js': "import './a.module.uxdsl';\nimport './b.module.uxdsl';\n", 'a.module.uxdsl': TOKENS, 'b.module.uxdsl': '.b { margin: space(2); }\n' };
  assert.deepEqual(themeWarnings(await run(config(project(t, modules)))), [], 'a CSS Module cannot carry the theme');
  const withGlobal = { ...modules, 'entry.js': "import './global.uxdsl';\nimport './a.module.uxdsl';\nimport './b.module.uxdsl';\n", 'global.uxdsl': 'body { margin: 0; }\n' };
  assert.deepEqual(themeWarnings(await run(config(project(t, withGlobal)))), [NONE]);
});

test('MIG-B9-20: in webpack watch mode the count covers modules the rebuild kept (style-loader and MiniCssExtractPlugin)', async (t) => {
  for (const extract of [false, true]) {
    const dir = project(t, { ...THREE, 'entry.js': "import './global.uxdsl';\nimport './a.uxdsl';\nimport './b.uxdsl';\nimport './other.js';\n", 'other.js': 'export default 1;\n' });
    const write = (file, text) => fs.writeFileSync(path.join(dir, file), text);
    const builds = [];
    let waiting = null;
    const compiler = webpack(config(dir, { extract }));
    const watching = compiler.watch({ aggregateTimeout: 100, poll: 100 }, (error, stats) => {
      const record = error ? { error } : { theme: themeWarnings(stats), errors: stats.hasErrors() ? stats.toString({ colors: false }) : null };
      builds.push(record);
      if (waiting) { const resolve = waiting; waiting = null; resolve(record); }
    });
    const next = () => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out waiting for a webpack build')), 30000);
      waiting = (record) => { clearTimeout(timer); resolve(record); };
    });
    const sequence = [];
    try {
      // webpack may build twice as it starts watching; neither says anything.
      await new Promise((resolve) => setTimeout(resolve, 2500));
      assert.ok(builds.length >= 1 && builds.every((b) => b.errors === null && b.theme.length === 0), `the first build: ${JSON.stringify(builds)}`);
      for (const [label, act] of [
        ['remove the marker', () => write('global.uxdsl', '/* no marker */\n')],
        ['edit other.js only', () => write('other.js', 'export default 2;\n')],
        ['restore the marker', () => write('global.uxdsl', '@uxdsl theme;\n')],
        ['edit a.uxdsl', () => write('a.uxdsl', '.a { padding: density(3); }\n')],
        ['the marker also in b', () => write('b.uxdsl', '@uxdsl theme;\n.b { margin: space(2); }\n')],
        ['edit other.js again', () => write('other.js', 'export default 3;\n')],
      ]) {
        const built = next();
        act();
        const record = await built;
        assert.equal(record.errors, null, `${label}: ${record.errors}`);
        sequence.push([label, record.theme]);
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    } finally {
      await new Promise((resolve) => watching.close(resolve));
    }
    const how = extract ? 'MiniCssExtractPlugin' : 'style-loader';
    assert.deepEqual(sequence, [
      ['remove the marker', [NONE]],
      ['edit other.js only', [NONE]],
      ['restore the marker', []],
      ['edit a.uxdsl', []],
      ['the marker also in b', [many(['b.uxdsl', 'global.uxdsl'])]],
      ['edit other.js again', [many(['b.uxdsl', 'global.uxdsl'])]],
    ], how);
  }
});

/** dist/webpack.js as a module of its own whose relative requires point at dist; `edit` changes its source. */
function loaderVariant(t, edit) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-webpack-variant-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const source = fs.readFileSync(LOADER, 'utf8').replace(/require\("\.\//g, `require(${JSON.stringify(`${DIST}/`).slice(0, -1)}`);
  const file = path.join(dir, 'webpack.js');
  fs.writeFileSync(file, edit(source));
  return file;
}

test('MIG-B9-20: with webpack\'s persistent cache, a rebuild of one component counts the cached global and b; without the issuer\'s copy of the flags the cached modules are not counted (negative control)', async (t) => {
  const sequence = async (loader, files = { ...THREE, 'b.uxdsl': '@uxdsl theme;\n' }) => {
    const dir = project(t, files);
    const cache = { type: 'filesystem', cacheDirectory: path.join(dir, '.cache') };
    const first = themeWarnings(await run(config(dir, { loader, cache })));
    fs.writeFileSync(path.join(dir, 'a.uxdsl'), `${TOKENS}.c { color: blue; }\n`);
    const second = themeWarnings(await run(config(dir, { loader, cache })));
    return { first, second };
  };
  // A correct project (one global with the marker) says nothing, cold or cached.
  assert.deepEqual(await sequence(LOADER, THREE), { first: [], second: [] });
  const real = await sequence(LOADER);
  assert.deepEqual(real.first, [many(['b.uxdsl', 'global.uxdsl'])]);
  assert.deepEqual(real.second, [many(['b.uxdsl', 'global.uxdsl'])], 'a new process, only a.uxdsl rebuilt: global and b counted from the cache');

  const propagation = 'issuer.buildInfo[BUILD_INFO_KEY] = flags';
  const withoutIssuer = loaderVariant(t, (source) => {
    assert.equal(source.split(propagation).length - 1, 1, 'control: the variant removes the one issuer copy');
    return source.replace(propagation, 'void 0');
  });
  const broken = await sequence(withoutIssuer);
  assert.deepEqual(broken.first, [many(['b.uxdsl', 'global.uxdsl'])], 'a cold build counts the modules it built');
  // webpack restores only the outer modules of global and b, which carry no
  // flags then: the count is incomplete, so it reports nothing (never a guess
  // of "none") and the two emitters go unreported.
  assert.deepEqual(broken.second, [], 'without the copy on the outer module, the cached emitters are lost');
});

test('MIG-B9-20: in child-compilation mode (experimentalUseImportModule: false) webpack prints no theme warning, never a false one', async (t) => {
  const mini = { experimentalUseImportModule: false };
  assert.deepEqual(themeWarnings(await run(config(project(t, THREE), { mini }))), []);
  assert.deepEqual(themeWarnings(await run(config(project(t, { ...THREE, 'global.uxdsl': '/* no marker */\n' }), { mini }))), [], 'the loader cannot see the end of the build there: silent, not a guess');
});
