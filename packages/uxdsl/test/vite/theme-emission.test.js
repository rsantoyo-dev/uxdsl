'use strict';

// The Vite plugin counts the theme over a whole build: each module's load()
// returns compile()'s `themeEmitted` (and whether its CSS references a
// --uxdsl__ token) as module meta, and `buildEnd` reads it for every .uxdsl
// module of the build, so no module reaching `@uxdsl theme;` while the CSS
// references tokens, or more than one module emitting the theme, is one
// UXD_THEME_MARKER warning per build. The dev server has no end of build: it
// warns only "more than one", when the set of emitting modules changes.
// Real `vite build`s, `vite build --watch` and a dev server, not a mocked
// plugin context.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const mod = require('../../dist/vite.js');
const uxdsl = mod.default || mod;
const { themeEmissionWarning } = require('../../dist/compile');

const TOKENS = '.a { padding: density(4); color: palette(primary.main); }\n';
const NONE = themeEmissionWarning([{ label: 'a.uxdsl', themeEmitted: false, referencesTokens: true, canCarryTheme: true }], 'module').text;
const many = (labels) => themeEmissionWarning(labels.map((label) => ({ label, themeEmitted: true, referencesTokens: true, canCarryTheme: true })), 'module').text;

function project(t, files) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-vite-theme-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  }
  if (!files['index.html']) fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><html><body><script type="module" src="/main.js"></script></body></html>\n');
  return dir;
}

/** A logger that keeps what Vite and its plugins print. */
function logger(sink) {
  return { info() {}, warn: (m) => sink.push(String(m)), warnOnce: (m) => sink.push(String(m)), error: (m) => sink.push(String(m)), clearScreen() {}, hasErrorLogged: () => false, hasWarned: false };
}

/** The plugin's own warnings of one build, as Rollup hands them over, without Vite's prefix. */
async function build(dir, { build: buildOptions = {}, options = {} } = {}) {
  const vite = await import('vite');
  const warnings = [];
  let error = null;
  try {
    await vite.build({
      root: dir,
      configFile: false,
      logLevel: 'silent',
      customLogger: logger([]),
      plugins: [uxdsl({ discoverTheme: false, ...options })],
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        ...buildOptions,
        rollupOptions: {
          ...(buildOptions.rollupOptions || {}),
          onwarn(warning) {
            if (warning.plugin === 'uxdsl') warnings.push(String(warning.message).replace(/^\[plugin uxdsl\] /, ''));
          },
        },
      },
    });
  } catch (caught) {
    error = caught;
  }
  return { warnings, error, theme: warnings.filter((w) => /UXD_THEME_MARKER/.test(w)) };
}

test('MIG-B9-20: Vite warns UXD_THEME_MARKER once at the end of a build when no module, or more than one, emitted the theme', async (t) => {
  // One global with the marker, next to components: nothing to say.
  const correct = project(t, { 'main.js': "import './global.uxdsl';\nimport './a.uxdsl';\nimport './b.uxdsl';\n", 'global.uxdsl': '@uxdsl theme;\n', 'a.uxdsl': TOKENS, 'b.uxdsl': '.b { margin: space(2); }\n' });
  assert.deepEqual((await build(correct)).theme, []);

  // No marker while the CSS references tokens: once, though two modules do.
  const none = project(t, { 'main.js': "import './a.uxdsl';\nimport './b.uxdsl';\n", 'a.uxdsl': TOKENS, 'b.uxdsl': '.b { margin: space(2); }\n' });
  assert.deepEqual((await build(none)).theme, [NONE]);
  assert.equal(NONE, 'UXD_THEME_MARKER: no module reaches `@uxdsl theme;`, so nothing this build writes defines the --uxdsl__ tokens its CSS references. Write `@uxdsl theme;` once, at the top level of the global stylesheet that defines them.');

  // A partial with the marker that two modules @use: each emits the theme.
  const shared = project(t, { 'main.js': "import './a.uxdsl';\nimport './b.uxdsl';\n", '_theme.uxdsl': '@uxdsl theme;\n', 'a.uxdsl': `@use './theme';\n${TOKENS}`, 'b.uxdsl': "@use './theme';\n.b { margin: space(2); }\n" });
  assert.deepEqual((await build(shared)).theme, [many(['a.uxdsl', 'b.uxdsl'])]);
  assert.match(many(['a.uxdsl', 'b.uxdsl']), /^UXD_THEME_MARKER: 2 modules emit the theme \(a\.uxdsl, b\.uxdsl\): each reaches `@uxdsl theme;`, itself or through a file it loads\./);

  // A plain import and an ?inline import of the global are two modules, named apart.
  const inline = project(t, { 'main.js': "import './global.uxdsl';\nimport inlined from './global.uxdsl?inline';\nimport './a.uxdsl';\nglobalThis.__inlined = inlined;\n", 'global.uxdsl': '@uxdsl theme;\n', 'a.uxdsl': TOKENS });
  assert.deepEqual((await build(inline)).theme, [many(['global.uxdsl', 'global.uxdsl?inline'])]);

  // Negative control: a module of plain CSS (no token, no marker) needs no theme.
  const plain = project(t, { 'main.js': "import './a.uxdsl';\n", 'a.uxdsl': '.a { color: red; }\n' });
  assert.deepEqual((await build(plain)).theme, []);
});

test('MIG-B9-20: Vite warns per build in an SSR build too, and a build that fails warns nothing about the theme', async (t) => {
  const dir = project(t, { 'main.js': "import './a.uxdsl';\nexport default 1;\n", 'a.uxdsl': TOKENS });
  const ssr = await build(dir, { build: { ssr: 'main.js' } });
  assert.equal(ssr.error, null, ssr.error && ssr.error.message);
  assert.deepEqual(ssr.theme, [NONE]);
  const marked = project(t, { 'main.js': "import './global.uxdsl';\nimport './a.uxdsl';\nexport default 1;\n", 'global.uxdsl': '@uxdsl theme;\n', 'a.uxdsl': TOKENS });
  assert.deepEqual((await build(marked, { build: { ssr: 'main.js' } })).theme, [], 'control: the marked SSR build is silent');

  const broken = project(t, { 'main.js': "import './a.uxdsl';\nimport './bad.uxdsl';\n", 'a.uxdsl': TOKENS, 'bad.uxdsl': '.bad { color: palette(nope.main); }\n' });
  const failed = await build(broken);
  assert.ok(failed.error, 'control: the build failed');
  assert.match(String(failed.error.message), /UXD_PALETTE_REFERENCE/);
  assert.deepEqual(failed.theme, []);
});

test('MIG-B9-20: a Vite build that fails outside the .uxdsl modules warns nothing about the theme', async (t) => {
  // Every .uxdsl module loads and returns its meta, so the count is complete
  // and would say "none": only the build's error keeps it silent.
  const dir = project(t, { 'main.js': "import './a.uxdsl';\nimport './b.js';\n", 'a.uxdsl': TOKENS, 'b.js': "import x from './missing.js';\nconsole.log(x);\n" });
  const failed = await build(dir);
  assert.ok(failed.error, 'control: the build failed');
  assert.match(String(failed.error.message), /missing\.js/);
  assert.deepEqual(failed.theme, []);
  // Control: the same project with the import fixed completes and says "none".
  fs.writeFileSync(path.join(dir, 'b.js'), 'console.log(1);\n');
  const fixed = await build(dir);
  assert.equal(fixed.error, null, fixed.error && fixed.error.message);
  assert.deepEqual(fixed.theme, [NONE]);
});

test('MIG-B9-20: vite build --watch warns on the build that loses the marker and is silent once it is restored', async (t) => {
  const vite = await import('vite');
  const dir = project(t, { 'main.js': "import './global.uxdsl';\nimport './a.uxdsl';\n", 'global.uxdsl': '@uxdsl theme;\n', 'a.uxdsl': TOKENS });
  const warnings = [];
  const watcher = await vite.build({
    root: dir,
    configFile: false,
    logLevel: 'silent',
    customLogger: logger([]),
    plugins: [uxdsl({ discoverTheme: false })],
    build: {
      outDir: 'dist',
      watch: { chokidar: { usePolling: true, interval: 50 } },
      rollupOptions: { onwarn(warning) { if (warning.plugin === 'uxdsl') warnings.push(String(warning.message)); } },
    },
  });
  const builds = [];
  const steps = [
    () => fs.writeFileSync(path.join(dir, 'global.uxdsl'), '/* no marker */\n'),
    () => fs.writeFileSync(path.join(dir, 'a.uxdsl'), `${TOKENS}.c { color: red; }\n`),
    () => fs.writeFileSync(path.join(dir, 'global.uxdsl'), '@uxdsl theme;\n'),
  ];
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out after ${builds.length} builds: ${JSON.stringify(builds)}`)), 60000);
      watcher.on('event', (event) => {
        if (event.code === 'BUNDLE_END') event.result?.close?.();
        if (event.code === 'ERROR') { clearTimeout(timer); reject(event.error); }
        if (event.code !== 'END') return;
        builds.push(warnings.splice(0).filter((w) => /UXD_THEME_MARKER/.test(w)));
        const next = steps.shift();
        if (next) setTimeout(next, 400);
        else { clearTimeout(timer); resolve(); }
      });
    });
  } finally {
    await watcher.close();
  }
  assert.equal(builds.length, 4, JSON.stringify(builds));
  assert.deepEqual(builds[0], [], 'with the marker: silent');
  assert.equal(builds[1].length, 1, 'the marker removed: one warning');
  assert.match(builds[1][0], /no module reaches `@uxdsl theme;`/);
  assert.equal(builds[2].length, 1, 'still no marker, a component edited: still one warning per build');
  assert.deepEqual(builds[3], [], 'the marker restored: silent');
});

test('MIG-B9-20: the Vite dev server warns once when more than one module emits the theme, and never reports none', async (t) => {
  const vite = await import('vite');
  const dir = project(t, { 'main.js': "import './a.uxdsl';\nimport './b.uxdsl';\nimport './c.uxdsl';\n", '_theme.uxdsl': '@uxdsl theme;\n', 'a.uxdsl': `@use './theme';\n${TOKENS}`, 'b.uxdsl': "@use './theme';\n.b { margin: space(2); }\n", 'c.uxdsl': TOKENS });
  const logged = [];
  const server = await vite.createServer({ root: dir, configFile: false, logLevel: 'warn', customLogger: logger(logged), appType: 'custom', server: { middlewareMode: true, hmr: false }, plugins: [uxdsl({ discoverTheme: false })] });
  const theme = () => logged.filter((m) => /UXD_THEME_MARKER/.test(m)).map((m) => m.replace(/\x1b\[[0-9;]*m/g, ''));
  try {
    await server.transformRequest('/c.uxdsl?uxdsl&lang.css');
    assert.deepEqual(theme(), [], 'one module without the marker: the dev server never says "none"');
    await server.transformRequest('/a.uxdsl?uxdsl&lang.css');
    assert.deepEqual(theme(), [], 'one emitting module');
    await server.transformRequest('/b.uxdsl?uxdsl&lang.css');
    assert.equal(theme().length, 1, JSON.stringify(theme()));
    assert.ok(theme()[0].includes(many(['a.uxdsl', 'b.uxdsl'])), theme()[0]);
    // Transformed again, the same set: not repeated.
    for (const file of ['a.uxdsl', 'b.uxdsl']) {
      for (const module of server.moduleGraph.getModulesByFile(path.join(dir, file)) || []) server.moduleGraph.invalidateModule(module);
      await server.transformRequest(`/${file}?uxdsl&lang.css`);
    }
    assert.equal(theme().length, 1, JSON.stringify(theme()));
    // Back to one emitting module, then two again: the set changed, so it warns again.
    const retransform = async (file) => {
      for (const module of server.moduleGraph.getModulesByFile(path.join(dir, file)) || []) server.moduleGraph.invalidateModule(module);
      await server.transformRequest(`/${file}?uxdsl&lang.css`);
    };
    fs.writeFileSync(path.join(dir, 'b.uxdsl'), '.b { margin: space(2); }\n');
    await retransform('b.uxdsl');
    assert.equal(theme().length, 1, 'one emitting module again: nothing new');
    fs.writeFileSync(path.join(dir, 'b.uxdsl'), "@use './theme';\n.b { margin: space(2); }\n");
    await retransform('b.uxdsl');
    assert.equal(theme().length, 2, JSON.stringify(theme()));
  } finally {
    await server.close();
  }
  assert.equal(theme().length, 2, 'nothing at close');
});
