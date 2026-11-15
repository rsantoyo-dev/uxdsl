'use strict';

// webpack's watch mode after a module's compile fails, with real webpack 5
// compilations and the loader from dist: the loader registers, before it
// reports the error, the files of the module's last successful compile in
// the same compiler, the file the error names, and the discovered theme
// file's require() tree, so the save that fixes the failure rebuilds. The
// error webpack prints names the file relative to rootContext, then the
// frame, with no stack line from the loader.

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

const MAIN = "@use './parts/card';\n.main { color: blue; }\n";
const CARD = '.card { color: red; }\n';
const CARD_SASS_ERROR = '.card { color: ; }\n';
const CARD_UXDSL_ERROR = '.card { padding: space(99); }\n';
const OTHER = '.other { color: gray; }\n';

const cleanups = new WeakMap();
/** Runs `fn` when the test ends, after every cleanup registered later: a watcher or server closes before its project is removed. */
function cleanup(t, fn) {
  if (!cleanups.has(t)) {
    const stack = [];
    cleanups.set(t, stack);
    t.after(async () => {
      while (stack.length) await stack.pop()();
    });
  }
  cleanups.get(t).push(fn);
}

/**
 * A project in its own temporary directory, removed when the test ends. Every
 * file and directory is dated ten seconds back, so a watcher started next does
 * not take them for edits. `dist` exists beforehand: webpack creating it in the
 * first build would change the project directory, which webpack watches, and
 * start one more build. A test makes all its projects before it starts a
 * watcher: webpack's watchers of one process share their directory watchers,
 * and a project created next to a watched one would look changed to its own.
 */
function project(t, files) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-webpack-recovery-')));
  cleanup(t, () => fs.rmSync(dir, { recursive: true, force: true }));
  const past = new Date(Date.now() - 10000);
  fs.mkdirSync(path.join(dir, 'dist'));
  fs.utimesSync(path.join(dir, 'dist'), past, past);
  for (const [file, text] of Object.entries({ 'src/index.js': "import '../styles/main.uxdsl';\n", ...files })) {
    const full = path.join(dir, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
    fs.utimesSync(full, past, past);
    for (let parent = path.dirname(full); parent.startsWith(dir); parent = path.dirname(parent)) fs.utimesSync(parent, past, past);
  }
  return dir;
}

/** The webpack configuration of `dir` with one of the two chains: mini-css-extract-plugin's loader (dist/main.css) or style-loader (dist/main.js). */
function config(dir, chain, options = { discoverTheme: false }) {
  const uxdsl = { loader: LOADER, options };
  return {
    mode: 'development',
    devtool: false,
    context: dir,
    entry: './src/index.js',
    output: { path: path.join(dir, 'dist'), filename: 'main.js' },
    module: { rules: [{ test: /\.uxdsl$/, use: chain === 'extract' ? [MiniCssExtractPlugin.loader, CSS_LOADER, uxdsl] : [STYLE_LOADER, CSS_LOADER, uxdsl] }] },
    plugins: chain === 'extract' ? [new MiniCssExtractPlugin({ filename: 'main.css' })] : [],
    infrastructureLogging: { level: 'none' },
  };
}

/** The file a chain writes the CSS to. */
const output = (dir, chain) => path.join(dir, 'dist', chain === 'extract' ? 'main.css' : 'main.js');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * compiler.watch(), one build at a time. `next(step)` resolves with the next
 * build's stats, errors included, and rejects naming `step` after 20 s.
 * `quiet(step, ms)` fails when the watcher sees a change (webpack's `invalid`
 * hook) within `ms`. The watcher is closed when the test ends.
 */
function watch(t, options) {
  const compiler = webpack(options);
  const ready = [];
  const waiting = [];
  const changed = [];
  compiler.hooks.invalid.tap('watch-recovery-test', (file) => changed.push(file));
  const watching = compiler.watch({ aggregateTimeout: 50 }, (err, stats) => {
    const build = { err, stats };
    const next = waiting.shift();
    if (next) next(build); else ready.push(build);
  });
  cleanup(t, () => new Promise((resolve) => watching.close(() => resolve())));
  return {
    next(step) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${step}: no webpack build within 20 s`)), 20000);
        const deliver = ({ err, stats }) => {
          clearTimeout(timer);
          if (err) reject(err); else resolve(stats);
        };
        const build = ready.shift();
        if (build) deliver(build); else waiting.push(deliver);
      });
    },
    async quiet(step, ms) {
      changed.length = 0;
      await delay(ms);
      assert.deepEqual(changed, [], `${step}: the watcher saw a change within ${ms} ms`);
      assert.equal(ready.length, 0, `${step}: a build ran within ${ms} ms`);
    },
  };
}

/** The text of a build's errors, one per line. */
const errorsOf = (stats) => stats.toJson({ all: false, errors: true }).errors.map((error) => error.message);

/** Writes a file and waits a moment, so the next build is the one that carries the edit. */
async function edit(dir, file, text) {
  await delay(300);
  const full = path.join(dir, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}

test('MIG-B9-39: webpack watch rebuilds when the partial that broke a module is fixed, with mini-css-extract-plugin and with style-loader', async (t) => {
  const dirs = { extract: project(t, { 'styles/main.uxdsl': MAIN, 'styles/parts/_card.uxdsl': CARD, 'styles/other.uxdsl': OTHER }) };
  dirs.style = project(t, { 'styles/main.uxdsl': MAIN, 'styles/parts/_card.uxdsl': CARD, 'styles/other.uxdsl': OTHER });
  for (const chain of ['extract', 'style']) {
    const dir = dirs[chain];
    const builds = watch(t, config(dir, chain));
    const good = await builds.next(`${chain}: the first build`);
    assert.deepEqual(errorsOf(good), []);
    const goodOutput = fs.readFileSync(output(dir, chain));

    await edit(dir, 'styles/parts/_card.uxdsl', CARD_SASS_ERROR);
    const failed = await builds.next(`${chain}: the build after the partial is broken`);
    assert.ok(errorsOf(failed).some((message) => /UXD_SASS: Expected expression\./.test(message)), errorsOf(failed).join('\n'));
    if (chain === 'extract') assert.deepEqual(fs.readFileSync(output(dir, chain)), goodOutput, 'the extracted main.css stays the last good one');

    // Negative control: a .uxdsl file the module never loaded is not registered.
    await edit(dir, 'styles/other.uxdsl', '.other { color: black; }\n');
    await builds.quiet(`${chain}: an edit to a file the module never loaded`, 2000);

    await edit(dir, 'styles/parts/_card.uxdsl', CARD);
    const fixed = await builds.next(`${chain}: the build after the partial is fixed`);
    assert.deepEqual(errorsOf(fixed), []);
    assert.deepEqual(fs.readFileSync(output(dir, chain)), goodOutput, `${chain}: the recovered output equals the first build's`);
  }
});

test("MIG-B9-39: webpack watch recovers when the failing compile's own partial, or the partial of a first build that failed, is fixed", async (t) => {
  // The failing compile is the first to load the partial, so no earlier compile recorded it.
  const dir = project(t, { 'styles/main.uxdsl': MAIN, 'styles/parts/_card.uxdsl': CARD, 'styles/parts/_newpart.uxdsl': '.newpart { color: ; }\n' });
  // A first build that failed: no compile of the module ever succeeded.
  const first = project(t, { 'styles/main.uxdsl': MAIN, 'styles/parts/_card.uxdsl': CARD_SASS_ERROR, 'styles/other.uxdsl': OTHER });
  const builds = watch(t, config(dir, 'extract'));
  assert.deepEqual(errorsOf(await builds.next('the first build')), []);
  await edit(dir, 'styles/main.uxdsl', `@use './parts/newpart';\n${MAIN}`);
  const failed = await builds.next('the build after the module @uses the broken partial');
  assert.ok(errorsOf(failed).some((message) => message.includes(`${path.join('styles', 'parts', '_newpart.uxdsl')}:1:`)), errorsOf(failed).join('\n'));
  await edit(dir, 'styles/parts/_newpart.uxdsl', '.newpart { color: green; }\n');
  assert.deepEqual(errorsOf(await builds.next('the build after the new partial is fixed')), []);
  assert.match(fs.readFileSync(output(dir, 'extract'), 'utf8'), /\.newpart \{\s*color: green;\s*\}/);

  const firstBuilds = watch(t, config(first, 'extract'));
  assert.ok(errorsOf(await firstBuilds.next('the first build, which fails')).some((message) => /UXD_SASS/.test(message)));
  await edit(first, 'styles/other.uxdsl', '.other { color: black; }\n');
  await firstBuilds.quiet('an edit to a file the module never loaded, after a first build that failed', 2000);
  await edit(first, 'styles/parts/_card.uxdsl', CARD);
  assert.deepEqual(errorsOf(await firstBuilds.next('the build after the partial of the first build is fixed')), []);
  assert.match(fs.readFileSync(output(first, 'extract'), 'utf8'), /\.card \{\s*color: red;\s*\}/);
});

test('MIG-B9-39: a partial deleted while a module loads it fails the module, and re-creating it rebuilds the module', async (t) => {
  const dir = project(t, { 'styles/main.uxdsl': MAIN, 'styles/parts/_card.uxdsl': CARD });
  const builds = watch(t, config(dir, 'extract'));
  assert.deepEqual(errorsOf(await builds.next('the first build')), []);
  const goodOutput = fs.readFileSync(output(dir, 'extract'));
  await delay(300);
  fs.rmSync(path.join(dir, 'styles/parts/_card.uxdsl'));
  const failed = await builds.next('the build after the partial is deleted');
  assert.ok(errorsOf(failed).some((message) => /UXD_SASS: Can't find stylesheet to import\./.test(message)), errorsOf(failed).join('\n'));
  await edit(dir, 'styles/parts/_card.uxdsl', CARD);
  assert.deepEqual(errorsOf(await builds.next('the build after the partial is created again')), []);
  assert.deepEqual(fs.readFileSync(output(dir, 'extract')), goodOutput);
});

test('MIG-B9-39: a first webpack build that fails in the discovered theme file recovers when the theme file is fixed', async (t) => {
  const files = { 'styles/main.uxdsl': '@uxdsl theme;\n.main { padding: space(2); }\n', 'uxdsl.theme.json': '{ "spacing": { "2": 5 } }\n' };
  const dir = project(t, files);
  // Negative control: with discoverTheme: false and a theme option, the theme file on disk is not registered.
  const off = project(t, { ...files, 'styles/main.uxdsl': '.main { color: ; }\n' });
  const builds = watch(t, config(dir, 'extract', {}));
  const failed = await builds.next('the first build, which fails in the theme file');
  assert.ok(errorsOf(failed).some((message) => /UXD_THEME_INVALID/.test(message)), errorsOf(failed).join('\n'));
  await edit(dir, 'uxdsl.theme.json', '{ "spacing": { "2": "7px" } }\n');
  assert.deepEqual(errorsOf(await builds.next('the build after the theme file is fixed')), []);
  assert.match(fs.readFileSync(output(dir, 'extract'), 'utf8'), /--uxdsl__space__2: 7px/);

  const offBuilds = watch(t, config(off, 'extract', { discoverTheme: false, theme: {} }));
  assert.ok(errorsOf(await offBuilds.next('the first build, which fails in the module')).some((message) => /UXD_SASS/.test(message)));
  await edit(off, 'uxdsl.theme.json', '{ "spacing": { "2": "7px" } }\n');
  await offBuilds.quiet('an edit to uxdsl.theme.json with discoverTheme: false and a theme option', 2000);
});

/** One webpack build with style-loader, which fails; its errors as toJson() and toString() give them. */
function failingBuild(dir) {
  return new Promise((resolve, reject) => {
    webpack(config(dir, 'style'), (err, stats) => {
      if (err) return reject(err);
      resolve({ json: errorsOf(stats), text: stats.toString({ colors: false }) });
    });
  });
}

test('MIG-B9-39: webpack reports a failed compile at the file relative to rootContext, then the frame, with no uxdsl stack line', async (t) => {
  const card = path.join('styles', 'parts', '_card.uxdsl');
  for (const [kind, text, position, frame] of [
    ['UXDSL', CARD_UXDSL_ERROR, `${card}:1:9: UXD_SPACE_REFERENCE`, /^ {2}> 1 \| /m],
    ['Sass', CARD_SASS_ERROR, `${card}:1:16: UXD_SASS: Expected expression.`, /^ {4}╷\s*$/m],
  ]) {
    const dir = project(t, { 'styles/main.uxdsl': MAIN, 'styles/parts/_card.uxdsl': text });
    const { json, text: printed } = await failingBuild(dir);
    assert.equal(json.length, 1, `${kind}: one module error\n${json.join('\n')}`);
    for (const [where, shown] of [['toJson', json[0]], ['toString', printed]]) {
      assert.ok(shown.includes(position), `${kind}, ${where}: the file relative to rootContext, its line and column\n${shown}`);
      // Every line outside the frame (whose lines are indented two spaces) names files relative to rootContext.
      const outside = shown.split('\n').filter((line) => !line.startsWith('  '));
      assert.deepEqual(outside.filter((line) => line.includes(`${dir}${path.sep}`)), [], `${kind}, ${where}: no absolute path under rootContext outside the frame`);
      assert.match(shown, frame, `${kind}, ${where}: the frame, indented two spaces`);
      assert.doesNotMatch(shown, /^\s*at .*\(/m, `${kind}, ${where}: no stack line\n${shown}`);
      assert.doesNotMatch(shown, /[\\/]dist[\\/][\w./-]+\.js:\d+:\d+/, `${kind}, ${where}: no position in uxdsl's dist\n${shown}`);
    }
    // The frame comes after the message's line.
    assert.ok(json[0].indexOf(position) < json[0].search(frame), `${kind}: the message, then the frame`);
  }
  // The two kinds draw different frames, so a loader that prints one kind for both fails above.
});
