'use strict';

// The Vite plugin after a load fails, with a real Vite dev server and real
// `vite build --watch` runs: the failed load registers the module's own file,
// the files of its last successful load, the file the error names and the
// discovered theme file's tree, so the save that fixes the failure updates
// the module (the dev server) or rebuilds (build --watch). The error the
// load throws carries `loc` and `frame`.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { temporaryDirectory } = require('../helpers/temporary-directory');
const path = require('node:path');

const mod = require('../../dist/vite.js');
const uxdsl = mod.default || mod;

const MAIN = "@use './parts/card';\n.main { color: blue; }\n";
const CARD = '.card { color: red; }\n';
const CARD_SASS_ERROR = '.card { color: ; }\n';
const CARD_UXDSL_ERROR = '.card { padding: space(99); }\n';
const OTHER = '.other { color: gray; }\n';
const MODULE_URL = '/styles/main.uxdsl?uxdsl&lang.css';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

// fs.realpathSync.native spells a component of os.tmpdir() written as an 8.3
// short name (C:\Users\RUNNER~1 on Windows) in its long form, as Vite, webpack
// and Dart Sass name the files they load; elsewhere it is fs.realpathSync.
/** A project in its own temporary directory, removed when the test passes. Every file and directory is dated ten seconds back, so a watcher started next does not take them for edits. */
function project(t, files) {
  const dir = fs.realpathSync.native(temporaryDirectory('uxdsl-vite-recovery-'));
  // Removed once the watchers and servers registered after it are closed, when the test passes; kept, with its path printed, when it fails.
  cleanup(t, () => {
    if (t.passed) fs.rmSync(dir, { recursive: true, force: true });
    else t.diagnostic(`temporary directory kept: ${dir}`);
  });
  const past = new Date(Date.now() - 10000);
  const all = {
    'index.html': '<!doctype html><html><body><script type="module" src="/main.js"></script></body></html>\n',
    'main.js': "import './styles/main.uxdsl';\n",
    ...files,
  };
  for (const [file, text] of Object.entries(all)) {
    const full = path.join(dir, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
    fs.utimesSync(full, past, past);
    for (let parent = path.dirname(full); parent.startsWith(dir); parent = path.dirname(parent)) fs.utimesSync(parent, past, past);
  }
  return dir;
}

/** Writes a file after a moment, so the watcher and the next request see the edit. */
async function edit(dir, file, text) {
  await delay(300);
  const full = path.join(dir, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}

/** A logger that prints nothing. */
const silent = { info() {}, warn() {}, warnOnce() {}, error() {}, clearScreen() {}, hasErrorLogged: () => false, hasWarned: false };

/**
 * The plugin, with each HMR hook it defines wrapped to record its calls: the
 * hook, the file and the URLs of the modules it returned (`calls`).
 */
function spiedPlugin(options) {
  const plugin = uxdsl(options);
  const calls = [];
  for (const name of ['hotUpdate', 'handleHotUpdate']) {
    const hook = plugin[name];
    if (typeof hook !== 'function') continue;
    plugin[name] = function (context, ...rest) {
      const result = hook.call(this, context, ...rest);
      calls.push({ hook: name, file: context.file, returned: result ? result.map((node) => node.url) : undefined });
      return result;
    };
  }
  return { plugin, calls };
}

/**
 * A dev server listening on a free port, closed when the test ends. It records
 * every update and full reload it sends to its clients (`messages`), the
 * error payloads (`errors`) and the plugin's HMR hook calls (`hookCalls`).
 * `waitFor(step, predicate)` resolves with the first message since the last
 * `clear()` that matches, and rejects naming `step` after 10 s.
 */
async function devServer(t, dir, options = { discoverTheme: false }) {
  const vite = await import('vite');
  const { plugin, calls: hookCalls } = spiedPlugin(options);
  const server = await vite.createServer({
    root: dir,
    configFile: false,
    logLevel: 'silent',
    customLogger: silent,
    appType: 'spa',
    plugins: [plugin],
    server: { port: 40000 + Math.floor(Math.random() * 9000), strictPort: false, watch: { usePolling: true, interval: 50 } },
  });
  cleanup(t, () => server.close());
  const messages = [];
  const errors = [];
  const send = server.ws.send.bind(server.ws);
  server.ws.send = (payload, ...rest) => {
    if (payload && typeof payload === 'object' && payload.type !== 'error') messages.push(payload);
    return send(payload, ...rest);
  };
  const hot = server.environments.client.hot;
  const hotSend = hot.send.bind(hot);
  hot.send = (payload, ...rest) => {
    if (payload && payload.type === 'error') errors.push(payload.err);
    return hotSend(payload, ...rest);
  };
  await server.listen();
  const base = server.resolvedUrls.local[0].replace(/\/$/, '');
  const js = await (await fetch(`${base}/main.js`)).text();
  assert.ok(js.includes(MODULE_URL), `main.js imports the module at ${MODULE_URL}:\n${js}`);
  return {
    server,
    messages,
    errors,
    hookCalls,
    clear() { messages.length = 0; errors.length = 0; hookCalls.length = 0; },
    /** The module as a browser fetches it after an update. */
    async fetchModule() {
      const response = await fetch(`${base}${MODULE_URL}&t=${Date.now()}`);
      return { status: response.status, body: await response.text() };
    },
    async waitFor(step, predicate) {
      const start = Date.now();
      while (Date.now() - start < 10000) {
        const found = messages.find(predicate);
        if (found) return found;
        await delay(50);
      }
      throw new Error(`${step}: not sent within 10 s; sent: ${JSON.stringify(messages)}`);
    },
  };
}

const updatesTheModule = (message) => message.type === 'update' && message.updates.some((update) => update.path === MODULE_URL);

test("MIG-B9-39: the Vite dev server sends the module's update when the failing load's own partial, or a first load's partial, is fixed", async (t) => {
  // The failing load is the first to load _newpart.uxdsl (a new @use whose file has an error).
  const dir = project(t, { 'styles/main.uxdsl': MAIN, 'styles/parts/_card.uxdsl': CARD, 'styles/parts/_newpart.uxdsl': '.newpart { color: ; }\n', 'styles/other.uxdsl': OTHER });
  const dev = await devServer(t, dir);
  assert.equal((await dev.fetchModule()).status, 200);

  dev.clear();
  await edit(dir, 'styles/main.uxdsl', `@use './parts/newpart';\n${MAIN}`);
  await dev.waitFor('the update after the module starts @using the broken partial', updatesTheModule);
  assert.equal((await dev.fetchModule()).status, 500, 'the load fails');

  // Negative control: a .uxdsl file the module never loaded sends nothing.
  dev.clear();
  await edit(dir, 'styles/other.uxdsl', '.other { color: black; }\n');
  await delay(2000);
  assert.deepEqual(dev.messages, [], 'an edit to a file the module never loaded sends nothing');

  dev.clear();
  await edit(dir, 'styles/parts/_newpart.uxdsl', '.newpart { color: green; }\n');
  await dev.waitFor('the update after the new partial is fixed', updatesTheModule);
  // Vite 7 runs `hotUpdate`, not `handleHotUpdate`, and the module comes from it.
  const newpart = path.join(dir, 'styles', 'parts', '_newpart.uxdsl');
  const fromHook = (call) => call.hook === 'hotUpdate' && path.resolve(call.file) === newpart && (call.returned || []).includes(MODULE_URL);
  assert.ok(dev.hookCalls.some(fromHook), `hotUpdate returned the module for the fix: ${JSON.stringify(dev.hookCalls)}`);
  assert.deepEqual(dev.hookCalls.filter((call) => call.hook === 'handleHotUpdate'), [], 'Vite 7 does not call handleHotUpdate');
  const fixed = await dev.fetchModule();
  assert.equal(fixed.status, 200);
  assert.match(fixed.body, /\.newpart \{\\n {2}color: green;/);

  // A first load that failed: Vite never analyzed the module, so it reloads the page, which loads it again.
  const first = project(t, { 'styles/main.uxdsl': MAIN, 'styles/parts/_card.uxdsl': CARD_SASS_ERROR, 'styles/other.uxdsl': OTHER });
  const firstDev = await devServer(t, first);
  assert.equal((await firstDev.fetchModule()).status, 500, 'the first load fails');
  firstDev.clear();
  await edit(first, 'styles/other.uxdsl', '.other { color: black; }\n');
  await delay(2000);
  assert.deepEqual(firstDev.messages, [], 'after a first load that failed, an edit to a file the module never loaded sends nothing');
  await edit(first, 'styles/parts/_card.uxdsl', CARD);
  await firstDev.waitFor('the full reload after the partial of the first load is fixed', (message) => message.type === 'full-reload');
  assert.ok(firstDev.hookCalls.some((call) => call.hook === 'hotUpdate' && (call.returned || []).includes('/main.js')), `hotUpdate returned the module's importer: ${JSON.stringify(firstDev.hookCalls)}`);
  const reloaded = await firstDev.fetchModule();
  assert.equal(reloaded.status, 200);
  assert.match(reloaded.body, /\.card \{\\n {2}color: red;/);
});

/**
 * `vite build --watch`, closed when the test ends. `next(step)` resolves with
 * the next build's outcome (`BUNDLE_END` or `ERROR`), and rejects naming
 * `step` after 20 s; `quiet(step, ms)` fails when Rollup's watcher reports a
 * change or a build within `ms`.
 */
async function buildWatch(t, dir, options = { discoverTheme: false }) {
  const vite = await import('vite');
  const watcher = await vite.build({
    root: dir,
    configFile: false,
    logLevel: 'silent',
    customLogger: silent,
    plugins: [uxdsl(options)],
    build: { outDir: 'dist', emptyOutDir: true, minify: false, cssMinify: false, watch: { chokidar: { usePolling: true, interval: 50 } } },
  });
  cleanup(t, () => watcher.close());
  const outcomes = [];
  const changes = [];
  watcher.on('change', (id) => changes.push(id));
  watcher.on('event', (event) => {
    if (event.code === 'BUNDLE_END') event.result?.close?.();
    if (event.code === 'BUNDLE_END' || event.code === 'ERROR') outcomes.push(event);
  });
  return {
    async next(step) {
      const start = Date.now();
      while (Date.now() - start < 20000) {
        if (outcomes.length) return outcomes.shift();
        await delay(50);
      }
      throw new Error(`${step}: no build within 20 s`);
    },
    async quiet(step, ms) {
      changes.length = 0;
      await delay(ms);
      assert.deepEqual(changes, [], `${step}: the watcher saw a change within ${ms} ms`);
      assert.deepEqual(outcomes.map((event) => event.code), [], `${step}: a build ran within ${ms} ms`);
    },
  };
}

/** The CSS the build wrote. */
function builtCss(dir) {
  const assets = path.join(dir, 'dist', 'assets');
  return fs.readdirSync(assets).filter((file) => file.endsWith('.css')).map((file) => fs.readFileSync(path.join(assets, file), 'utf8')).join('\n');
}

test('MIG-B9-39: vite build --watch rebuilds after a failed build when the module, the failing build\'s own partial, or a first build\'s partial is fixed', async (t) => {
  const dir = project(t, { 'styles/main.uxdsl': MAIN, 'styles/parts/_card.uxdsl': CARD, 'styles/parts/_newpart.uxdsl': '.newpart { color: ; }\n', 'styles/other.uxdsl': OTHER });
  const builds = await buildWatch(t, dir);
  assert.equal((await builds.next('the first build')).code, 'BUNDLE_END');
  const goodCss = builtCss(dir);
  assert.match(goodCss, /\.card \{\s*color: red;\s*\}/);

  await edit(dir, 'styles/main.uxdsl', `@use './parts/newpart';\n${MAIN}`);
  assert.equal((await builds.next('the build after the module starts @using the broken partial')).code, 'ERROR');

  // Negative control: a file no build loaded starts no rebuild.
  await edit(dir, 'styles/other.uxdsl', '.other { color: black; }\n');
  await builds.quiet('an edit to a file no build loaded', 3000);

  await edit(dir, 'styles/parts/_newpart.uxdsl', '.newpart { color: green; }\n');
  assert.equal((await builds.next('the build after the new partial is fixed')).code, 'BUNDLE_END');
  assert.match(builtCss(dir), /\.newpart \{\s*color: green;\s*\}/);

  // A first build that failed: the module's own file, then the partial at fault.
  const first = project(t, { 'styles/main.uxdsl': MAIN, 'styles/parts/_card.uxdsl': CARD_SASS_ERROR });
  const firstBuilds = await buildWatch(t, first);
  assert.equal((await firstBuilds.next('the first build, which fails')).code, 'ERROR');
  await edit(first, 'styles/main.uxdsl', MAIN);
  assert.equal((await firstBuilds.next('the build after the module is saved unchanged')).code, 'ERROR');
  await edit(first, 'styles/parts/_card.uxdsl', CARD);
  assert.equal((await firstBuilds.next('the build after the partial of the first build is fixed')).code, 'BUNDLE_END');
  assert.equal(builtCss(first), goodCss, 'the recovered build writes what a first good build writes');
});

test("MIG-B9-39: a failed Vite load carries loc and frame, in the dev server's error payload and in build --watch's ERROR event", async (t) => {
  const card = (dir) => path.join(dir, 'styles', 'parts', '_card.uxdsl');
  const check = (where, error, dir, column, frame) => {
    assert.deepEqual(error.loc, { file: card(dir), line: 1, column }, `${where}: loc`);
    assert.match(error.frame || '', frame, `${where}: frame`);
  };
  const UXDSL_FRAME = /^> 1 \| /m;
  const SASS_FRAME = /^ {2}╷/m;
  // The two frames differ, so a plugin that draws one kind for both fails below.
  assert.doesNotMatch('  ╷\n1 │ .card { color: ; }\n', UXDSL_FRAME);
  assert.doesNotMatch('> 1 | .card { padding: space(99); }\n', SASS_FRAME);

  // The dev server: a Sass error, a UXDSL error, then a theme error, which names no file.
  const dir = project(t, { 'styles/main.uxdsl': MAIN, 'styles/parts/_card.uxdsl': CARD_SASS_ERROR, 'uxdsl.theme.json': '{}\n' });
  const dev = await devServer(t, dir, {});
  const failedPayload = async (step) => {
    dev.server.environments.client.moduleGraph.invalidateAll();
    dev.clear();
    assert.equal((await dev.fetchModule()).status, 500, `${step}: the load fails`);
    const start = Date.now();
    while (!dev.errors.length && Date.now() - start < 10000) await delay(50);
    assert.ok(dev.errors.length, `${step}: an error payload within 10 s`);
    return dev.errors[0];
  };
  const sassError = await failedPayload('the Sass error');
  check('dev, Sass error', sassError, dir, 16, SASS_FRAME);
  assert.equal(sassError.message, `${card(dir)}:1:16: UXD_SASS: Expected expression.`, 'the message is unchanged');
  await edit(dir, 'styles/parts/_card.uxdsl', CARD_UXDSL_ERROR);
  const uxdslError = await failedPayload('the UXDSL error');
  check('dev, UXDSL error', uxdslError, dir, 9, UXDSL_FRAME);
  assert.ok(uxdslError.message.includes(`${card(dir)}:1:9: UXD_SPACE_REFERENCE`), `the message is unchanged: ${uxdslError.message}`);
  await edit(dir, 'uxdsl.theme.json', '{ "spacing": { "2": 5 } }\n');
  const themeError = await failedPayload('the theme error');
  assert.match(themeError.message, /UXD_THEME_INVALID/);
  assert.equal(themeError.loc, undefined, 'a theme error has no loc');
  assert.ok(!themeError.frame, 'a theme error has no frame');

  // build --watch: the same three, each from an edit after the last failed build.
  const watched = project(t, { 'styles/main.uxdsl': MAIN, 'styles/parts/_card.uxdsl': CARD_SASS_ERROR, 'uxdsl.theme.json': '{}\n' });
  const builds = await buildWatch(t, watched, {});
  const sass = await builds.next('the first build, which fails in Sass');
  assert.equal(sass.code, 'ERROR');
  check('build --watch, Sass error', sass.error, watched, 16, SASS_FRAME);
  await edit(watched, 'styles/parts/_card.uxdsl', CARD_UXDSL_ERROR);
  const uxdslEvent = await builds.next('the build after a UXDSL error');
  assert.equal(uxdslEvent.code, 'ERROR');
  check('build --watch, UXDSL error', uxdslEvent.error, watched, 9, UXDSL_FRAME);
  await edit(watched, 'uxdsl.theme.json', '{ "spacing": { "2": 5 } }\n');
  const themeEvent = await builds.next('the build after the theme file is broken');
  assert.equal(themeEvent.code, 'ERROR');
  assert.match(themeEvent.error.message, /UXD_THEME_INVALID/);
  assert.equal(themeEvent.error.loc, undefined, 'build --watch: a theme error has no loc');
  assert.ok(!themeEvent.error.frame, 'build --watch: a theme error has no frame');
});

// A module that reaches `@uxdsl theme;`, and the value its CSS declares for
// the primary color: the base theme's reference, or the theme file's literal.
const THEMED = '@uxdsl theme;\n.main { color: palette(primary.main); }\n';
const themeJson = (color) => `{ "palette": { "primary": { "main": "${color}" } } }\n`;
const primaryMain = (css) => (css.match(/--uxdsl__palette__primary-main:\s*([^;\\]+);/) || [])[1];

test('the Vite dev server loads a theme file created after it started, edited, deleted and created again under another name; a file of another name, or discovery turned off, sends nothing (negative controls)', async (t) => {
  const dir = project(t, { 'styles/main.uxdsl': THEMED });
  const off = project(t, { 'styles/main.uxdsl': THEMED });
  const dev = await devServer(t, dir, {});
  const base = primaryMain((await dev.fetchModule()).body);
  assert.ok(base && base.startsWith('var(--uxdsl__color__'), `with no theme file, the base theme's reference: ${base}`);

  const expectValue = async (step, value) => {
    await dev.waitFor(step, updatesTheModule);
    assert.equal(primaryMain((await dev.fetchModule()).body), value, step);
  };

  dev.clear();
  await edit(dir, 'uxdsl.theme.json', themeJson('#111111'));
  await expectValue('the update after uxdsl.theme.json is created', '#111111');

  dev.clear();
  await edit(dir, 'uxdsl.theme.json', themeJson('#222222'));
  await expectValue('the update after uxdsl.theme.json is edited', '#222222');

  dev.clear();
  await delay(300);
  fs.rmSync(path.join(dir, 'uxdsl.theme.json'));
  await expectValue('the update after uxdsl.theme.json is deleted', base);

  dev.clear();
  await edit(dir, 'uxdsl.theme.cjs', "module.exports = { palette: { primary: { main: '#333333' } } };\n");
  await expectValue('the update after uxdsl.theme.cjs is created', '#333333');

  // Negative control: a new file beside it whose name is not a theme file's.
  dev.clear();
  await edit(dir, 'uxdsl.theme.txt', themeJson('#444444'));
  await edit(dir, 'notes.json', '{}\n');
  await delay(2000);
  assert.deepEqual(dev.messages, [], 'a new file that is not a theme file sends nothing');

  // Negative control: with discovery off, a theme file created on disk is not followed.
  const offDev = await devServer(t, off, { discoverTheme: false });
  assert.equal(primaryMain((await offDev.fetchModule()).body), base);
  offDev.clear();
  await edit(off, 'uxdsl.theme.json', themeJson('#111111'));
  await delay(2000);
  assert.deepEqual(offDev.messages, [], 'with discoverTheme: false, a theme file created on disk sends nothing');
  assert.equal(primaryMain((await offDev.fetchModule()).body), base);
});

/**
 * The primary color the built CSS carries, once it is `expected`. Creating or deleting a file
 * can report two events (Windows: add, then change), so a second rebuild may start, and empty
 * dist/, right after the BUNDLE_END the test waited for: read until the value is there rather
 * than once.
 */
async function builtPrimaryIs(dir, expected, step, timeout = 10000) {
  const start = Date.now();
  let last = null;
  for (;;) {
    try {
      last = primaryMain(builtCss(dir));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      last = '(dist/ emptied by a rebuild in progress)';
    }
    if (last === expected) return;
    if (Date.now() - start > timeout) throw new Error(`${step}: primary is ${last}, expected ${expected}`);
    await delay(150);
  }
}

test('vite build --watch rebuilds with a theme file created after it started, and after it is deleted; with discovery off it does not (negative control)', async (t) => {
  const dir = project(t, { 'styles/main.uxdsl': THEMED });
  const off = project(t, { 'styles/main.uxdsl': THEMED });
  const builds = await buildWatch(t, dir, {});
  assert.equal((await builds.next('the first build')).code, 'BUNDLE_END');
  const base = primaryMain(builtCss(dir));
  assert.ok(base && base.startsWith('var(--uxdsl__color__'), `with no theme file, the base theme's reference: ${base}`);

  await edit(dir, 'uxdsl.theme.json', themeJson('#111111'));
  assert.equal((await builds.next('the build after uxdsl.theme.json is created')).code, 'BUNDLE_END');
  await builtPrimaryIs(dir, '#111111', 'after uxdsl.theme.json is created');

  await delay(300);
  fs.rmSync(path.join(dir, 'uxdsl.theme.json'));
  assert.equal((await builds.next('the build after uxdsl.theme.json is deleted')).code, 'BUNDLE_END');
  await builtPrimaryIs(dir, base, 'after uxdsl.theme.json is deleted');

  await edit(dir, 'uxdsl.theme.json', themeJson('#222222'));
  assert.equal((await builds.next('the build after uxdsl.theme.json is created again')).code, 'BUNDLE_END');
  await builtPrimaryIs(dir, '#222222', 'after uxdsl.theme.json is created again');

  const offBuilds = await buildWatch(t, off, { discoverTheme: false });
  assert.equal((await offBuilds.next('the first build with discovery off')).code, 'BUNDLE_END');
  await edit(off, 'uxdsl.theme.json', themeJson('#111111'));
  await offBuilds.quiet('a theme file created with discoverTheme: false', 3000);
});
