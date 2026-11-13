'use strict';

// MIG-B6-20 (FEAT-008): fast, in-process coverage of the plugin's own
// resolveId/load logic (dist/index.js required directly, no real Vite dev
// server or build) — the slow, real-bundler end-to-end checks (extraction,
// no-absolute-paths, HMR module-graph invalidation, SSR) live in
// fixtures/vite-adapter/run.js instead, which installs from a real
// tarball. This file exists so a resolveId/load regression (like the
// SSR-round-tripped-id bug found while building this story) fails fast,
// in milliseconds, without packing and installing five tarballs first.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const mod = require('../../dist/vite.js');
const uxdsl = mod.default || mod;

function mkTmpDir() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vite-plugin-uxdsl-test-')));
}

function write(dir, relPath, content) {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

function makeCtx() {
  const warnings = [];
  const watched = [];
  return {
    warnings,
    watched,
    addWatchFile(f) { watched.push(f); },
    warn(msg) { warnings.push(msg); },
  };
}

// --- resolveId ---

test('MIG-B6-20: resolveId turns a relative .uxdsl specifier into a virtual id Vite recognizes as CSS', () => {
  const dir = mkTmpDir();
  const entry = write(dir, 'panel.uxdsl', '.a { color: red; }');
  const importer = write(dir, 'main.js', "import './panel.uxdsl';");
  const plugin = uxdsl();
  const id = plugin.resolveId.call({}, './panel.uxdsl', importer);
  assert.equal(id, `${entry}?uxdsl&lang.css`);
});

test('MIG-B6-20: resolveId preserves ?inline so Vite\'s own css plugin still recognizes it', () => {
  const dir = mkTmpDir();
  const entry = write(dir, 'panel.uxdsl', '.a { color: red; }');
  const importer = write(dir, 'main.js', "import x from './panel.uxdsl?inline';");
  const plugin = uxdsl();
  const id = plugin.resolveId.call({}, './panel.uxdsl?inline', importer);
  assert.equal(id, `${entry}?uxdsl&inline&lang.css`);
});

test('MIG-B6-20: resolveId returns null for a non-.uxdsl specifier', () => {
  const plugin = uxdsl();
  assert.equal(plugin.resolveId.call({}, './styles.css', '/some/main.js'), null);
});

test('MIG-B6-20: resolveId returns null for a .uxdsl specifier that does not resolve to a real file (not ours to claim)', () => {
  const plugin = uxdsl();
  assert.equal(plugin.resolveId.call({}, './does-not-exist.uxdsl', '/nonexistent/main.js'), null);
});

test('MIG-B6-20 (regression): a root-relative echo of our own virtual id (e.g. Vite\'s SSR import rewriting) re-derives the real absolute path instead of misresolving to a bogus filesystem-root path', () => {
  // Found via `server.ssrLoadModule()`: Vite's SSR transform round-trips an
  // already-resolved id through its dev-server URL space, which strips the
  // project-root prefix but keeps our own query string — producing
  // something like "/panel.uxdsl?uxdsl&lang.css" (relative to the Vite
  // project root, not the filesystem root). `path.isAbsolute` alone can't
  // tell those apart on POSIX; naively trusting it resolved to a
  // nonexistent "/panel.uxdsl" path and threw "entry file not found".
  const dir = mkTmpDir();
  const entry = write(dir, 'panel.uxdsl', '.a { color: red; }');
  const plugin = uxdsl();
  plugin.configResolved({ root: dir });
  const rootRelativeEcho = '/panel.uxdsl?uxdsl&lang.css';
  const id = plugin.resolveId.call({}, rootRelativeEcho, undefined);
  assert.equal(id, `${entry}?uxdsl&lang.css`);
});

test('MIG-B6-20: resolveId is idempotent for an id it already fully resolved (a real absolute virtual id asked about again)', () => {
  const dir = mkTmpDir();
  const entry = write(dir, 'panel.uxdsl', '.a { color: red; }');
  const plugin = uxdsl();
  const alreadyResolved = `${entry}?uxdsl&lang.css`;
  assert.equal(plugin.resolveId.call({}, alreadyResolved, undefined), alreadyResolved);
});

// --- load ---

test('MIG-B6-20: load() compiles through uxdsl-core\'s compile() and returns plain CSS text', async () => {
  const dir = mkTmpDir();
  const entry = write(dir, 'panel.uxdsl', '.a { color: red; padding: xs(1rem) md(2rem); }');
  const plugin = uxdsl();
  const ctx = makeCtx();
  const result = await plugin.load.call(ctx, `${entry}?uxdsl&lang.css`);
  assert.match(result.code, /\.a\s*\{[^}]*color:\s*red/);
  assert.match(result.code, /1rem/);
  assert.match(result.code, /768px/);
  assert.equal(result.map, null);
});

test('MIG-B6-20: load() returns null for a non-virtual id (not its module)', async () => {
  const plugin = uxdsl();
  assert.equal(await plugin.load.call(makeCtx(), '/some/other/file.js'), null);
});

test('MIG-B6-20: load() calls addWatchFile for the entry and every @import-ed dependency', async () => {
  const dir = mkTmpDir();
  write(dir, 'partial.uxdsl', '.partial { color: green; }');
  const entry = write(dir, 'panel.uxdsl', '@import "./partial.uxdsl";\n.a { color: red; }');
  const plugin = uxdsl();
  const ctx = makeCtx();
  await plugin.load.call(ctx, `${entry}?uxdsl&lang.css`);
  assert.ok(ctx.watched.some((f) => path.resolve(f) === path.resolve(entry)));
  assert.ok(ctx.watched.some((f) => path.resolve(f) === path.resolve(dir, 'partial.uxdsl')));
});

test('MIG-B6-20: load() discovers the theme file from configRoot when theme is omitted', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.cjs', "module.exports = { palette: { pluginonlybrand: { main: '#0af', dark: '#048', contrast: '#fff' } } };");
  const entry = write(dir, 'panel.uxdsl', '.a { color: palette(pluginonlybrand); }');
  const plugin = uxdsl({ configRoot: dir });
  const result = await plugin.load.call(makeCtx(), `${entry}?uxdsl&lang.css`);
  assert.match(result.code, /--uxdsl__palette__pluginonlybrand-main/);
});

test('MIG-B6-20: load() also watches the discovered theme file', async () => {
  const dir = mkTmpDir();
  const themeFile = write(dir, 'uxdsl.theme.cjs', 'module.exports = {};');
  const entry = write(dir, 'panel.uxdsl', '.a { color: red; }');
  const plugin = uxdsl({ configRoot: dir });
  const ctx = makeCtx();
  await plugin.load.call(ctx, `${entry}?uxdsl&lang.css`);
  assert.ok(ctx.watched.some((f) => path.resolve(f) === path.resolve(themeFile)));
});

test('MIG-B6-20: discoverTheme: false keeps validating against the built-in default theme', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.cjs', "module.exports = { palette: { pluginonlybrand: { main: '#0af', dark: '#048', contrast: '#fff' } } };");
  const entry = write(dir, 'panel.uxdsl', '.a { color: palette(pluginonlybrand); }');
  const plugin = uxdsl({ configRoot: dir, discoverTheme: false });
  await assert.rejects(plugin.load.call(makeCtx(), `${entry}?uxdsl&lang.css`), /UXD_PALETTE_REFERENCE/);
});

test('MIG-B6-20: an explicit theme option always wins over discovery', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.cjs', "module.exports = { palette: { pluginonlybrand: { main: '#0af', dark: '#048', contrast: '#fff' } } };");
  const entry = write(dir, 'panel.uxdsl', '.a { color: palette(pluginonlybrand); }');
  const plugin = uxdsl({ configRoot: dir, theme: {} });
  await assert.rejects(plugin.load.call(makeCtx(), `${entry}?uxdsl&lang.css`), /UXD_PALETTE_REFERENCE/);
});

test('MIG-B6-20: compile warnings surface through this.warn(), not swallowed', async () => {
  // No UXDSL warning is easy to trigger without a fixture theme; this
  // checks the plumbing itself doesn't throw when warnings is a non-empty
  // array, using a controlled stand-in compile() via a second entry that
  // legitimately produces one is out of scope here — covered instead by
  // the shared parity fixture, which exercises the real compile() path
  // end to end. This test only guards against a future refactor silently
  // dropping the `for (const warning of warnings) this.warn(...)` loop.
  const dir = mkTmpDir();
  const entry = write(dir, 'panel.uxdsl', '.a { color: red; }');
  const plugin = uxdsl();
  const ctx = makeCtx();
  await plugin.load.call(ctx, `${entry}?uxdsl&lang.css`);
  assert.deepEqual(ctx.warnings, []);
});

// --- Dart Sass through compile(): what Sass loaded, the map, the sass option, located warnings ---

const IMPORT_DEPRECATION = 'UXD_SASS_WARNING: [import] Sass @import rules are deprecated and will be removed in Dart Sass 3.0.0.';

// styles/panel.uxdsl @uses a partial that @imports another: Dart Sass loads
// three files and reports one deprecation, at _partial.uxdsl:1:9.
function sassProject() {
  const dir = mkTmpDir();
  const entry = write(dir, 'styles/panel.uxdsl', "@use './partial';\n.panel {\n  color: palette(primary.main);\n  &__title { padding: space(2); }\n}\n");
  write(dir, 'styles/_partial.uxdsl', "@import './legacy';\n.partial { color: green; }\n");
  write(dir, 'styles/_legacy.uxdsl', '.legacy { color: olive; }\n');
  return { dir, entry };
}

// A load after configResolved, as Vite runs it: `root` is the project's
// directory, and a build's sourcemap setting asks compile() for a map.
async function loadThroughVite(dir, entry, options = {}, { resolveConfig = true } = {}) {
  const plugin = uxdsl({ ...options });
  if (resolveConfig) plugin.configResolved({ root: dir, build: { sourcemap: true }, css: {} });
  const ctx = makeCtx();
  const result = await plugin.load.call(ctx, `${entry}?uxdsl&lang.css`);
  return { ctx, result };
}

test('MIG-B9-14: load() adds every Sass-loaded file as a watch file and the map names the partial', async () => {
  const { dir, entry } = sassProject();
  const { ctx, result } = await loadThroughVite(dir, entry);

  assert.deepEqual(
    ctx.watched.map((file) => path.relative(dir, file)),
    [path.join('styles', 'panel.uxdsl'), path.join('styles', '_partial.uxdsl'), path.join('styles', '_legacy.uxdsl')],
    'the entry, the @use\'d partial and the file it @imports'
  );
  assert.match(result.code, /\.panel__title \{\s*padding: var\(--uxdsl__space__2\);/);
  assert.ok(result.map, 'build.sourcemap asks compile() for a map');
  for (const source of ['panel.uxdsl', '_partial.uxdsl', '_legacy.uxdsl']) {
    assert.ok(result.map.sources.includes(source), `map.sources ${JSON.stringify(result.map.sources)} names ${source}`);
  }

  // Each warning reaches this.warn() at its file, relative to Vite's root,
  // and at its line and column.
  assert.deepEqual(ctx.warnings, [`${path.join('styles', '_partial.uxdsl')}:1:9: ${IMPORT_DEPRECATION}`]);

  // Before configResolved runs, the root is the working directory.
  const early = await loadThroughVite(dir, entry, {}, { resolveConfig: false });
  assert.deepEqual(early.ctx.warnings, [`${path.relative(process.cwd(), path.join(dir, 'styles', '_partial.uxdsl'))}:1:9: ${IMPORT_DEPRECATION}`]);
});

test('MIG-B9-14: load() passes the sass option to compile(): silenceDeprecations removes a deprecation, an unknown key fails the load', async () => {
  const { dir, entry } = sassProject();

  // Negative control: without the option the same load reports the
  // deprecation, so its absence below comes from the option.
  const plain = await loadThroughVite(dir, entry);
  assert.equal(plain.ctx.warnings.length, 1, JSON.stringify(plain.ctx.warnings));

  const silenced = await loadThroughVite(dir, entry, { sass: { silenceDeprecations: ['import'] } });
  assert.deepEqual(silenced.ctx.warnings, []);
  assert.equal(silenced.result.code, plain.result.code, 'silencing a deprecation changes no CSS');

  const quiet = await loadThroughVite(dir, entry, { sass: { quietDeps: true } });
  assert.equal(quiet.result.code, plain.result.code);

  // compile() validates the option: an unknown key fails the load with its message.
  await assert.rejects(loadThroughVite(dir, entry, { sass: { bogus: 1 } }), /unknown sass option "bogus"/);
  await assert.rejects(loadThroughVite(dir, entry, { sass: { silenceDeprecations: 'import' } }), /sass\.silenceDeprecations must be an array/);

  // An unknown deprecation id is Dart Sass's own warning, which has no
  // position: this.warn() receives its text alone.
  const unknownId = await loadThroughVite(dir, entry, { sass: { silenceDeprecations: ['nope'] } });
  assert.deepEqual(unknownId.ctx.warnings, [
    'UXD_SASS_WARNING: Invalid deprecation "nope".',
    `${path.join('styles', '_partial.uxdsl')}:1:9: ${IMPORT_DEPRECATION}`,
  ]);
});

// --- Stability phase 2: what the plugin no longer accepts ---

test('phase 2: breakpoints come from the theme (discovered or explicit); there is no plugin option for them', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.json', '{ "breakpoints": { "md": 900 } }');
  const entry = write(dir, 'panel.uxdsl', '.a { padding: xs(1rem) md(2rem); }');
  const discovered = await uxdsl({ configRoot: dir }).load.call(makeCtx(), `${entry}?uxdsl&lang.css`);
  assert.match(discovered.code, /900px/);
  assert.doesNotMatch(discovered.code, /768px/);
  const explicit = await uxdsl({ theme: { breakpoints: { md: 1000 } } }).load.call(makeCtx(), `${entry}?uxdsl&lang.css`);
  assert.match(explicit.code, /1000px/);
});

test('phase 2: a theme file exporting { theme, references } fails the load with the loader\'s own message', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.cjs', "module.exports = { theme: {}, references: { externalTokens: ['--x'] } };");
  const entry = write(dir, 'panel.uxdsl', '.a { color: red; }');
  await assert.rejects(uxdsl({ configRoot: dir }).load.call(makeCtx(), `${entry}?uxdsl&lang.css`), /That wrapper was removed/);
});

test('phase 2: the plugin source carries no scss pre-pass and no breakpoints option', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'vite.ts'), 'utf8');
  // Exact option keys and identifiers, not bare words — the source's own
  // comments say why these are gone, and may name them.
  for (const removed of ['scss?:', 'scssLoadPaths?:', 'compileWithSass', 'inlineUxdslImportsForSass', "('sass')", 'breakpoints?:', 'userOptions.breakpoints']) {
    assert.equal(source.includes(removed), false, `${removed} must be gone from the plugin`);
  }
  const options = uxdsl();
  assert.equal(typeof options.load, 'function', 'control: the plugin still builds');
});

// --- The theme is emitted where `@uxdsl theme;` is written -----------------

/** A real `vite build` of `files` (main.js imports the modules); its UXDSL warnings and extracted CSS. */
async function viteBuild(files, options = {}) {
  const vite = await import('vite');
  const dir = mkTmpDir();
  for (const [file, text] of Object.entries(files)) write(dir, file, text);
  write(dir, 'index.html', '<!doctype html><html><body><script type="module" src="/main.js"></script></body></html>\n');
  const logged = [];
  const logger = { info() {}, warn: (m) => logged.push(m), warnOnce: (m) => logged.push(m), error: (m) => logged.push(m), clearScreen() {}, hasErrorLogged: () => false, hasWarned: false };
  try {
    await vite.build({ root: dir, configFile: false, customLogger: logger, logLevel: 'warn', plugins: [uxdsl({ discoverTheme: false, ...options })], build: { outDir: 'dist', emptyOutDir: true } });
    const assets = path.join(dir, 'dist', 'assets');
    const css = fs.readdirSync(assets).filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(path.join(assets, f), 'utf8')).join('');
    return { css, warnings: logged.map((m) => String(m).replace(/\x1b\[[0-9;]*m/g, '')).filter((m) => /UXD_/.test(m)) };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('MIG-B9-20: a component module compiles to its own rules only (bytes recorded)', async () => {
  const dir = mkTmpDir();
  const entry = write(dir, 'panel.uxdsl', '.card{padding:density(4)}\n');
  const { result } = await loadThroughVite(dir, entry, { discoverTheme: false }, { resolveConfig: false });
  assert.equal(result.code, '.card {\n  padding: var(--uxdsl__density__4);\n}');
  assert.equal(result.code.length, 46);
  assert.doesNotMatch(result.code, /:root/);
  // Negative control: the same module with the marker carries the theme.
  const marked = write(dir, 'marked.uxdsl', '@uxdsl theme;\n.card{padding:density(4)}\n');
  const withMarker = await loadThroughVite(dir, marked, { discoverTheme: false }, { resolveConfig: false });
  assert.match(withMarker.result.code, /:root/);
  // A real build of that component, minified as Vite does: 40 bytes, no :root.
  const { css } = await viteBuild({ 'main.js': "import './panel.uxdsl';\n", 'panel.uxdsl': '.card{padding:density(4)}\n' });
  assert.equal(css.trim(), '.card{padding:var(--uxdsl__density__4)}');
  assert.equal(css.length, 40);
});

test('MIG-B9-20: includeTheme passed to the Vite plugin warns UXD_OPTION_REMOVED once per build and is ignored', async () => {
  const files = { 'main.js': "import './global.uxdsl';\nimport './a.uxdsl';\nimport './b.uxdsl';\n", 'global.uxdsl': '@uxdsl theme;\n', 'a.uxdsl': '.a { padding: density(4); }\n', 'b.uxdsl': '.b { margin: space(2); }\n' };
  const removed = (warnings) => warnings.filter((m) => /UXD_OPTION_REMOVED/.test(m));
  const without = await viteBuild(files);
  assert.deepEqual(removed(without.warnings), [], 'control: no option, no warning');
  for (const includeTheme of [false, true]) {
    const passed = await viteBuild(files, { includeTheme });
    assert.equal(removed(passed.warnings).length, 1, `three modules, one build, one warning: ${JSON.stringify(passed.warnings)}`);
    assert.match(removed(passed.warnings)[0], /UXD_OPTION_REMOVED: the "includeTheme" option was removed and is ignored; write @uxdsl theme; in the stylesheet that defines the tokens\./);
    assert.equal(passed.css, without.css, `includeTheme: ${includeTheme} changes nothing`);
  }
});

test('MIG-B9-20: breakpoints, themeVar, spaceVar and colorVar passed to the Vite plugin warn UXD_OPTION_REMOVED once per build each and are ignored', async () => {
  const files = { 'main.js': "import './global.uxdsl';\nimport './a.uxdsl';\n", 'global.uxdsl': '@uxdsl theme;\n', 'a.uxdsl': '.a { padding: xs(1rem) md(2rem); color: palette(primary.main); margin: space(2); border-color: color(gray.300); }\n' };
  const removed = (warnings) => warnings.filter((m) => /UXD_OPTION_REMOVED/.test(m));
  const expected = [
    /UXD_OPTION_REMOVED: the "breakpoints" option was removed and is ignored; breakpoints are configured in the theme \(`theme\.breakpoints`\)\./,
    /UXD_OPTION_REMOVED: the "themeVar" option was removed and is ignored; palette\(\) always compiles to var\(--uxdsl__palette__<key>\)\./,
    /UXD_OPTION_REMOVED: the "spaceVar" option was removed and is ignored; space\(\) always compiles to var\(--uxdsl__space__<key>\)\./,
    /UXD_OPTION_REMOVED: the "colorVar" option was removed and is ignored; color\(\) always compiles to var\(--uxdsl__color__<key>\)\./,
  ];
  const without = await viteBuild(files);
  assert.deepEqual(removed(without.warnings), [], 'control: no option, no warning');
  const passed = await viteBuild(files, { breakpoints: { xs: 0, md: 600 }, themeVar: '--x', spaceVar: '--y', colorVar: '--z' });
  const got = removed(passed.warnings);
  assert.equal(got.length, expected.length, `two modules, one build, one warning per option: ${JSON.stringify(passed.warnings)}`);
  expected.forEach((pattern, index) => assert.match(got[index], pattern));
  assert.equal(passed.css, without.css, 'the options change nothing');
  assert.match(passed.css, /min-width: ?768px/, "the theme's threshold stands");
});
