'use strict';

// MIG-B2-01 (FEAT-003): config/theme discovery and references propagation.
// Exercises the pure-ish functions bin/uxdsl.js exports (loadConfig and
// friends) directly against real temp-directory fixtures, instead of
// spawning the CLI as a subprocess and depending on process.exit.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const postcss = require('postcss');

const CLI_BIN = path.join(__dirname, '..', '..', 'bin', 'uxdsl.js');
const cli = require('../../bin/uxdsl.js');
const uxdslPluginModule = require('../../dist/plugin');
const uxdslPlugin = uxdslPluginModule.default || uxdslPluginModule;
const { DEFAULT_THEME, resolveTheme: resolveThemeForTests } = require('../helpers/ds-runtime');

function captureWarnings(fn) {
  const original = console.warn;
  const messages = [];
  console.warn = (...args) => { messages.push(args.join(' ')); };
  try {
    return { result: fn(), messages };
  } finally {
    console.warn = original;
  }
}

async function captureWarningsAsync(fn) {
  const original = console.warn;
  const messages = [];
  console.warn = (...args) => { messages.push(args.join(' ')); };
  try {
    return { result: await fn(), messages };
  } finally {
    console.warn = original;
  }
}

function mkTmpDir() {
  // Realpath-resolved so every path this test builds from `dir` (globs,
  // configPath, themeConfigPath, ...) already matches the form
  // require.resolve() naturally produces for a newly-discovered nested
  // require() — on macOS, os.tmpdir() lives under /tmp, itself a symlink
  // to /private/tmp; without this, a test could construct an "expected"
  // path via path.join(dir, ...) that differs textually from the real
  // path the code under test actually resolves to, despite naming the
  // exact same file on disk.
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-cli-test-')));
}

function write(dir, relPath, content) {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

// Full 1-16 spacing plus the palette families the always-on density/
// surface/button/input defaults need, so strict reference validation (the
// CLI's default) passes — same fixture shape used throughout postcss-uxdsl's
// own test suite. See docs/features/FEAT-002-beta-migration-hardening.md.
const FULL_SPACING = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i + 1, `${(i + 1) * 4}px`]));
const BASE_PALETTE = { primary: { main: '#123', dark: '#111', contrast: '#fff' }, surface: { main: '#fff', dark: '#eee', contrast: '#000' }, neutral: { main: '#999', dark: '#333' }, error: { main: '#f00' } };
const FULL_THEME = { spacing: FULL_SPACING, palette: BASE_PALETTE };

test('MIG-B2-01: discovers every supported theme-config extension', async () => {
  for (const candidate of cli.THEME_CANDIDATES) {
    const dir = mkTmpDir();
    write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
    write(dir, 'src/entry.uxdsl', '.x { color: red; }');
    const content = candidate.endsWith('.json')
      ? JSON.stringify({ palette: { primary: { main: '#123' } } })
      : `module.exports = ${JSON.stringify({ palette: { primary: { main: '#123' } } })};`;
    write(dir, candidate, content);
    const config = await cli.loadConfig({}, dir);
    assert.deepEqual(config.theme, { palette: { primary: { main: '#123' } } }, `candidate ${candidate}`);
  }
});

test('MIG-B2-01: resolves config/theme/entry paths relative to the file that declares them, not cwd', async () => {
  const dir = mkTmpDir();
  const projectDir = path.join(dir, 'project');
  write(projectDir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', watch: ['src/**/*.uxdsl'] };`);
  const entryPath = write(projectDir, 'src/entry.uxdsl', '.x { color: red; }');
  write(projectDir, 'uxdsl.theme.cjs', `module.exports = { palette: { primary: { main: '#123' } } };`);
  // cwd is the parent of `project/` — only --config tells loadConfig where
  // the real project lives, mirroring "uxdsl --config project/uxdsl.config.cjs"
  // run from somewhere else entirely.
  const config = await cli.loadConfig({ config: path.join('project', 'uxdsl.config.cjs') }, dir);
  assert.equal(config.entry, entryPath);
  assert.equal(config.theme.palette.primary.main, '#123');
  assert.ok(config.watch.includes(path.join(projectDir, 'src/**/*.uxdsl')), `expected config-relative watch glob in ${JSON.stringify(config.watch)}`);
});

test('MIG-B2-01: a theme file exporting a bare object is treated as the theme itself', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.cjs', `module.exports = { fonts: { families: { ui: 'Inter' } } };`);
  const config = await cli.loadConfig({}, dir);
  assert.deepEqual(config.theme, { fonts: { families: { ui: 'Inter' } } });
  assert.equal(config.references, undefined);
});

test('phase 2: a theme file exporting { theme, references } is refused, naming where each half goes', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.cjs', `module.exports = { theme: { fonts: { families: { ui: 'Inter' } } }, references: { externalTokens: ['--host-token'] } };`);
  await assert.rejects(
    () => cli.loadConfig({}, dir),
    /uxdsl\.theme\.cjs exports \{ theme, references \}\. That wrapper was removed: a theme file exports the theme itself.*`references` belongs in uxdsl\.config\.cjs/
  );
});

// A raw `var(--host-token)` written directly by the user (not produced by
// any UXDSL function) is deliberately never checked at all — MIG-03's
// "distinguish references UXDSL emits from external CSS" contract means
// unrelated host CSS the user wrote is out of scope, `externalTokens` or
// not. To reach a real check, the host variable has to flow through a
// UXDSL-generated declaration instead: `theme.fonts.families` becomes a
// literal `--uxdsl__font__<key>: <value>;` declaration in the emitted
// :root — that declaration is newly generated by the plugin (not in the
// user's original source), so it IS a checked "consumer", exactly the
// Next.js `--font-geist-sans` case FEAT-003 describes.
const HOST_FONT_THEME = { ...FULL_THEME, fonts: { families: { ui: 'var(--host-token)' } } };

test('MIG-B2-01: externalTokens declared in uxdsl.config.cjs lets a UXDSL-generated declaration reference a host variable with no fallback', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', references: { externalTokens: ['--host-token'] } };`);
  write(dir, 'src/entry.uxdsl', '/* no component rules needed — includeTheme defaults to true */');
  write(dir, 'uxdsl.theme.cjs', `module.exports = ${JSON.stringify(HOST_FONT_THEME)};`);
  const config = await cli.loadConfig({}, dir);
  const source = fs.readFileSync(config.entry, 'utf8');
  const result = await postcss([uxdslPlugin({ theme: config.theme, references: config.references })]).process(source, { from: config.entry });
  assert.match(result.css, /--uxdsl__font__ui: var\(--host-token\)/);
});

test('MIG-B2-01: the same theme without externalTokens still fails with UXD_REFERENCE_MISSING', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '/* no component rules needed — includeTheme defaults to true */');
  write(dir, 'uxdsl.theme.cjs', `module.exports = ${JSON.stringify(HOST_FONT_THEME)};`);
  const config = await cli.loadConfig({}, dir);
  assert.equal(config.references, undefined);
  const source = fs.readFileSync(config.entry, 'utf8');
  await assert.rejects(
    () => postcss([uxdslPlugin({ theme: config.theme, references: config.references })]).process(source, { from: config.entry }).then((r) => r.css),
    /UXD_REFERENCE_MISSING/
  );
});

test('phase 2: `references` has one home — the build config; the theme file carries none', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', references: { externalTokens: ['--from-build'] } };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.cjs', `module.exports = { fonts: { families: { ui: 'Inter' } } };`);
  const config = await cli.loadConfig({}, dir);
  assert.deepEqual(config.references, { externalTokens: ['--from-build'] });
  assert.deepEqual(config.theme, { fonts: { families: { ui: 'Inter' } } });
  assert.equal('references' in config.theme, false);
});

test('phase 2: a uxdsl.config.json is not a build config (discovery ignores it; --config refuses it)', async () => {
  assert.deepEqual(cli.CONFIG_CANDIDATES, ['uxdsl.config.cjs', 'uxdsl.config.js']);
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.json', JSON.stringify({ entry: './src/entry.uxdsl', outFile: './src/out.css' }));
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  assert.equal(await cli.loadConfig({}, dir), null, 'not discovered');
  await assert.rejects(() => cli.loadConfig({ config: 'uxdsl.config.json' }, dir), /a build config is a JavaScript module \(uxdsl\.config\.js or uxdsl\.config\.cjs\)\. JSON is for the theme/);
});

test('MIG-B2-01: --config pointing at a missing file fails with a clear, specific error', async () => {
  const dir = mkTmpDir();
  await assert.rejects(
    () => cli.loadConfig({ config: 'missing.cjs' }, dir),
    /Configuration file not found:.*missing\.cjs/
  );
});

test('MIG-B2-01: the discovered theme file is added to the watch list', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  const themePath = write(dir, 'uxdsl.theme.cjs', `module.exports = {};`);
  const config = await cli.loadConfig({}, dir);
  assert.ok(config.watch.includes(themePath), `expected ${themePath} in ${JSON.stringify(config.watch)}`);
});

test('MIG-B2-01 (implementation item 10): a theme file with no uxdsl.config.cjs falls back to the conventional entry/output when it exists', async () => {
  const dir = mkTmpDir();
  const entryPath = write(dir, cli.DEFAULT_ENTRY_REL, '.x { color: red; }');
  write(dir, 'uxdsl.theme.cjs', `module.exports = { fonts: { families: { ui: 'Inter' } } };`);
  const config = await cli.loadConfig({}, dir);
  assert.equal(config.entry, entryPath);
  assert.equal(config.outFile, path.resolve(dir, cli.DEFAULT_OUT_REL));
  assert.deepEqual(config.theme, { fonts: { families: { ui: 'Inter' } } });
});

test('MIG-B2-01 (implementation item 10): a theme file with no config and no conventional entry fails with an actionable error', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.cjs', `module.exports = {};`);
  await assert.rejects(
    () => cli.loadConfig({}, dir),
    /Run "npx uxdsl init"/
  );
});

test('MIG-B2-01: no config, no theme file, no direct args -> null (existing "print help" signal preserved)', async () => {
  const dir = mkTmpDir();
  const config = await cli.loadConfig({}, dir);
  assert.equal(config, null);
});

// --- Stability phase 2: build-config keys that moved, each a hard error
// naming the new home rather than a silently ignored key. ---

for (const [key, value, home] of [
  ['theme', `{ fonts: { families: { ui: 'Georgia' } } }`, /put the theme in a theme file next to this config/],
  ['themeFile', `'./theme/custom.cjs'`, /name the theme file uxdsl\.theme\.json \(or uxdsl\.theme\.js\/\.cjs\) next to this config/],
  ['breakpoints', `{ xl: 1600 }`, /declare "breakpoints" in the theme file/],
  ['output', `'./src/out.css'`, /use "outFile"/],
]) {
  test(`phase 2: "${key}" in uxdsl.config.cjs is a hard error that says where it now goes`, async () => {
    const dir = mkTmpDir();
    write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', ${key}: ${value} };`);
    write(dir, 'src/entry.uxdsl', '.x { color: red; }');
    await assert.rejects(() => cli.loadConfig({}, dir), new RegExp(`Invalid configuration in .*uxdsl\\.config\\.cjs: "${key}" is not a build-config key any more`));
    await assert.rejects(() => cli.loadConfig({}, dir), home);
  });
}

test('phase 2: "output" inside a builds[] entry is rejected the same way', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { builds: [{ entry: './src/entry.uxdsl', output: './src/out.css' }] };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  await assert.rejects(() => cli.loadConfig({}, dir), /"builds\[0\]\.output" is not a build-config key any more — use "outFile"/);
});

test('phase 2: the theme file is discovered by name next to the build config, and is the only theme source', async () => {
  const dir = mkTmpDir();
  write(dir, 'config/uxdsl.config.cjs', `module.exports = { entry: '../src/entry.uxdsl', outFile: '../src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'config/uxdsl.theme.json', JSON.stringify({ fonts: { families: { ui: 'Custom' } } }));
  write(dir, 'uxdsl.theme.json', JSON.stringify({ fonts: { families: { ui: 'Ignored: not next to the config' } } }));
  const config = await cli.loadConfig({ config: 'config/uxdsl.config.cjs' }, dir);
  assert.deepEqual(config.theme, { fonts: { families: { ui: 'Custom' } } });
});

test('MIG-B2-03: generated entries rely on the canonical plugin theme instead of importing legacy defaults', async () => {
  const dir = mkTmpDir();
  write(dir, 'src/components/Button.uxdsl', '.button { color: red; }');
  const outFile = path.join(dir, 'src/uxdsl-entry.uxdsl');
  await cli.generateEntry({ src: path.join(dir, 'src'), out: outFile });
  const generated = fs.readFileSync(outFile, 'utf8');
  assert.doesNotMatch(generated, /postcss-uxdsl\/theme\/default-/);
  assert.match(generated, /components\/Button\.uxdsl/);
});

// --- MIG-B3-01 (FEAT-004): includeTheme/breakpoints reach the plugin ---
// Root cause fixed here: `buildOnce` used to hand the plugin a hardcoded
// three-key allowlist (breakpoints/theme/references) with breakpoints
// eagerly defaulted before the theme was even resolved. `includeTheme` was
// unreachable from the CLI, and `theme.breakpoints` (already supported by
// the plugin) was permanently shadowed by that eager default.

test('MIG-B3-01: resolveIncludeTheme — flag overrides config, config overrides the true default', () => {
  assert.equal(cli.resolveIncludeTheme(undefined, undefined), true);
  assert.equal(cli.resolveIncludeTheme(undefined, false), false);
  assert.equal(cli.resolveIncludeTheme(undefined, true), true);
  assert.equal(cli.resolveIncludeTheme(true, false), true);
  assert.equal(cli.resolveIncludeTheme(false, true), false);
});

test('MIG-B3-01: "includeTheme" in uxdsl.config.cjs reaches loadConfig\'s resolved config', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', includeTheme: false };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  const config = await cli.loadConfig({}, dir);
  assert.equal(config.includeTheme, false);
});

test('MIG-B3-01: --no-include-theme overrides a config that declares includeTheme: true', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', includeTheme: true };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  const config = await cli.loadConfig({ 'include-theme': false }, dir);
  assert.equal(config.includeTheme, false);
});

test('MIG-B3-01: a non-boolean "includeTheme" in uxdsl.config.cjs is a hard, actionable error', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', includeTheme: 'yes' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  await assert.rejects(() => cli.loadConfig({}, dir), /"includeTheme" must be a boolean/);
});

test('phase 2: a theme-declared breakpoint reaches the compiled output through the theme, with no separate breakpoints channel', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', includeTheme: false };`);
  write(dir, 'src/entry.uxdsl', '.x { width: xs(100%) xl(50%); }');
  write(dir, 'uxdsl.theme.cjs', `module.exports = { breakpoints: { xl: 1440 } };`);
  const config = await cli.loadConfig({}, dir);
  assert.equal(config.theme.breakpoints.xl, 1440);
  assert.equal('breakpoints' in config, false, 'the resolved config carries no breakpoints of its own');
  await cli.buildOnce(config);
  const css = fs.readFileSync(config.outFile, 'utf8');
  assert.match(css, /@media \(min-width: 1440px\)/);
  assert.doesNotMatch(css, /1280px/);
});

test('MIG-B3-01: buildOnce with includeTheme: false emits no :root', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', includeTheme: false };`);
  write(dir, 'src/entry.uxdsl', `.card { @ds-surface(contained); }`);
  const config = await cli.loadConfig({}, dir);
  config.theme = FULL_THEME;
  await cli.buildOnce(config);
  const css = fs.readFileSync(config.outFile, 'utf8');
  assert.doesNotMatch(css, /:root/);
});

test('MIG-B3-01: buildOnce with includeTheme: true (default) still emits :root — and no breakpoint marker (stability phase 2)', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', `.card { @ds-surface(contained); }`);
  const config = await cli.loadConfig({}, dir);
  config.theme = FULL_THEME;
  await cli.buildOnce(config);
  const css = fs.readFileSync(config.outFile, 'utf8');
  assert.match(css, /:root/);
  // The `/*@uxdsl-bp …*/` trailer and `#uxdsl-bp-meta` rule fed the removed
  // breakpoint rewriter; a theme entry ends with its last real rule now.
  assert.doesNotMatch(css, /#uxdsl-bp-meta/);
  assert.doesNotMatch(css, /@uxdsl-bp/);
});

test('MIG-B3-01: a theme entry and a component entry compiled separately compose without any duplicate definitions', async () => {
  const dir = mkTmpDir();
  write(dir, 'theme.uxdsl', '/* theme-only entry */');
  write(dir, 'panel.uxdsl', `.card { @ds-surface(contained); }`);
  const themeConfig = await cli.loadConfig({ entry: path.join(dir, 'theme.uxdsl'), out: path.join(dir, 'theme.css') }, dir);
  themeConfig.theme = FULL_THEME;
  themeConfig.includeTheme = true;
  await cli.buildOnce(themeConfig);
  const panelConfig = await cli.loadConfig({ entry: path.join(dir, 'panel.uxdsl'), out: path.join(dir, 'panel.css') }, dir);
  panelConfig.theme = FULL_THEME;
  panelConfig.includeTheme = false;
  await cli.buildOnce(panelConfig);

  const themeCss = fs.readFileSync(themeConfig.outFile, 'utf8');
  const panelCss = fs.readFileSync(panelConfig.outFile, 'utf8');
  assert.match(themeCss, /:root/, 'the theme entry must still define :root');
  assert.doesNotMatch(panelCss, /:root/, 'the component entry must not define it a second time');
  // The component entry's own reference (@ds-surface) must still resolve —
  // includeTheme: false only skips emitting definitions, not validation.
  assert.match(panelConfig && fs.readFileSync(panelConfig.outFile, 'utf8'), /background/);
});

test('MIG-B3-01: includeTheme: false still fails with UXD_REFERENCE_MISSING for an unknown token', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', includeTheme: false };`);
  write(dir, 'src/entry.uxdsl', `.x { color: shadow(nonexistent); }`);
  const config = await cli.loadConfig({}, dir);
  config.theme = FULL_THEME;
  await assert.rejects(() => cli.buildOnce(config), /UXD_SHADOW_REFERENCE|UXD_REFERENCE_MISSING/);
});

// --- MIG-B3-03 (FEAT-004): theme-file/build-config collision diagnostic ---
// A theme file's entire export is the theme — a uxdsl.config.cjs accidentally
// copied/renamed to a theme-file name silently "worked" with its
// entry/outFile/watch keys quietly ignored as unknown tokens.

test('MIG-B3-03: warnIfLooksLikeBuildConfig warns when a theme export has build-config keys', () => {
  const { messages } = captureWarnings(() =>
    cli.warnIfLooksLikeBuildConfig({ entry: './src/entry.uxdsl', outFile: './src/out.css' }, '/project/uxdsl.theme.cjs')
  );
  assert.equal(messages.length, 1);
  assert.match(messages[0], /uxdsl\.theme\.cjs/);
  assert.match(messages[0], /"entry"/);
  assert.match(messages[0], /"outFile"/);
});

test('MIG-B3-03: warnIfLooksLikeBuildConfig stays silent for a bare theme object with no build-config-shaped keys', () => {
  const { messages } = captureWarnings(() =>
    cli.warnIfLooksLikeBuildConfig({ fonts: { families: { ui: 'Inter' } } }, '/project/uxdsl.theme.cjs')
  );
  assert.deepEqual(messages, []);
});

test('MIG-B3-03: loadConfig surfaces the collision warning for a real theme file shaped like a build config', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  // A build-config file accidentally saved under the theme-file name.
  write(dir, 'uxdsl.theme.cjs', `module.exports = { entry: './other/entry.uxdsl', outFile: './other/out.css', watch: [] };`);
  const { messages } = await captureWarningsAsync(() => cli.loadConfig({}, dir));
  assert.ok(messages.some((m) => /looks like a build config/.test(m)), `expected a collision warning; got ${JSON.stringify(messages)}`);
});

test('MIG-B3-03: the same theme-file shape only warns once per session (no per-rebuild spam)', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.cjs', `module.exports = { entry: './other/entry.uxdsl' };`);
  const { messages: first } = await captureWarningsAsync(() => cli.loadConfig({}, dir));
  assert.equal(first.length, 1);
  const { messages: second } = await captureWarningsAsync(() => cli.loadConfig({}, dir));
  assert.deepEqual(second, [], 'a second loadConfig call with the identical shape must not warn again');
});

// --- MIG-B3-02 (FEAT-004): multiple entries in one uxdsl.config.cjs ---
// A `builds` array compiles a theme entry and any number of component/
// CSS-Module entries against the same shared theme/references in a single
// `uxdsl build`/`watch` invocation.

test('MIG-B3-02: "builds" cannot be combined with a top-level "entry"/"outFile"', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './a.uxdsl', outFile: './a.css', builds: [{ entry: './b.uxdsl', outFile: './b.css' }] };`);
  await assert.rejects(() => cli.loadConfig({}, dir), /"builds" cannot be combined with a top-level "entry"\/"outFile"/);
});

test('MIG-B3-02: "builds" must be a non-empty array', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { builds: [] };`);
  await assert.rejects(() => cli.loadConfig({}, dir), /"builds" must be a non-empty array/);
});

test('MIG-B3-02: each builds[] entry is validated the same way a top-level entry/outFile/includeTheme would be', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { builds: [{ entry: 123, outFile: './a.css' }] };`);
  await assert.rejects(() => cli.loadConfig({}, dir), /"builds\[0\]\.entry" must be a string path/);
});

test('MIG-B3-02: loadConfig resolves each builds[] entry\'s paths relative to the build config, with per-entry includeTheme', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = {
    builds: [
      { entry: './src/theme.uxdsl', outFile: './src/theme.css', includeTheme: true },
      { entry: './src/panel.uxdsl', outFile: './src/panel.css', includeTheme: false },
    ],
  };`);
  write(dir, 'src/theme.uxdsl', '/* theme */');
  write(dir, 'src/panel.uxdsl', '/* panel */');
  const config = await cli.loadConfig({}, dir);
  assert.equal(config.builds.length, 2);
  assert.equal(config.builds[0].entry, path.join(dir, 'src/theme.uxdsl'));
  assert.equal(config.builds[0].outFile, path.join(dir, 'src/theme.css'));
  assert.equal(config.builds[0].includeTheme, true);
  assert.equal(config.builds[1].includeTheme, false);
});

test('MIG-B3-02: --no-include-theme overrides every builds[] entry uniformly when passed', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = {
    builds: [
      { entry: './a.uxdsl', outFile: './a.css', includeTheme: true },
      { entry: './b.uxdsl', outFile: './b.css' },
    ],
  };`);
  write(dir, 'a.uxdsl', '');
  write(dir, 'b.uxdsl', '');
  const config = await cli.loadConfig({ 'include-theme': false }, dir);
  assert.equal(config.builds[0].includeTheme, false);
  assert.equal(config.builds[1].includeTheme, false);
});

test('MIG-B3-02: default watch globs cover every builds[] entry and its directory, deduplicated', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = {
    builds: [
      { entry: './src/theme.uxdsl', outFile: './src/theme.css' },
      { entry: './src/panel.uxdsl', outFile: './src/panel.css' },
    ],
  };`);
  write(dir, 'src/theme.uxdsl', '');
  write(dir, 'src/panel.uxdsl', '');
  const config = await cli.loadConfig({}, dir);
  const srcGlob = path.join(dir, 'src', '**/*.uxdsl');
  assert.equal(config.watch.filter((w) => w === srcGlob).length, 1, 'the shared directory glob must not be duplicated');
  assert.ok(config.watch.includes(path.join(dir, 'src/theme.uxdsl')));
  assert.ok(config.watch.includes(path.join(dir, 'src/panel.uxdsl')));
});

test('MIG-B3-02: buildOnce compiles a theme entry and a component entry from one "builds" config with no duplicate definitions', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = {
    builds: [
      { entry: './theme.uxdsl', outFile: './theme.css', includeTheme: true },
      { entry: './panel.uxdsl', outFile: './panel.css', includeTheme: false },
    ],
  };`);
  write(dir, 'theme.uxdsl', '/* theme-only entry */');
  write(dir, 'panel.uxdsl', `.card { @ds-surface(contained); }`);
  const config = await cli.loadConfig({}, dir);
  config.theme = FULL_THEME;
  await cli.buildOnce(config);

  const themeCss = fs.readFileSync(config.builds[0].outFile, 'utf8');
  const panelCss = fs.readFileSync(config.builds[1].outFile, 'utf8');
  assert.match(themeCss, /:root/);
  assert.doesNotMatch(panelCss, /:root/);
  assert.match(panelCss, /background/);
});

test('MIG-B3-02: buildOnce writes nothing at all when one of several builds[] entries fails to compile', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = {
    builds: [
      { entry: './ok.uxdsl', outFile: './ok.css' },
      { entry: './broken.uxdsl', outFile: './broken.css' },
    ],
  };`);
  write(dir, 'ok.uxdsl', '.x { color: red; }');
  write(dir, 'broken.uxdsl', '.x { color: shadow(nonexistent); }');
  const config = await cli.loadConfig({}, dir);
  config.theme = FULL_THEME;
  await assert.rejects(() => cli.buildOnce(config), /builds\[1\].*broken\.css/);
  assert.ok(!fs.existsSync(config.builds[0].outFile), 'the earlier, successfully-compiled entry must not be written either');
  assert.ok(!fs.existsSync(config.builds[1].outFile));
});

// --- MIG-B4-02 (FEAT-005): auto-watch of transitive local require()s ---
// clearRequireCache already walked a config/theme file's full require()
// tree to invalidate the cache; collectLocalRequireTree is that same walk,
// now also used to populate the watch list so editing a nested module (not
// just the top-level file) actually produces a filesystem event.

function cleanupRequireCache(...paths) {
  for (const p of paths) {
    try { delete require.cache[require.resolve(p)]; } catch (_) { /* not required — nothing to clean up */ }
  }
}

test('MIG-B4-02: collectLocalRequireTree includes the root and a direct nested require()', () => {
  const dir = mkTmpDir();
  const childPath = write(dir, 'child.js', 'module.exports = 1;');
  const rootPath = write(dir, 'root.js', `module.exports = require('./child.js');`);
  require(rootPath); // populate require.cache with the real tree, like loadModuleExport would
  try {
    const ids = cli.collectLocalRequireTree(rootPath);
    assert.ok(ids.has(require.resolve(rootPath)), `expected the root itself in ${JSON.stringify([...ids])}`);
    assert.ok(ids.has(require.resolve(childPath)), `expected the nested require() in ${JSON.stringify([...ids])}`);
  } finally {
    cleanupRequireCache(rootPath, childPath);
  }
});

test('MIG-B4-02: collectLocalRequireTree follows nesting two levels deep', () => {
  const dir = mkTmpDir();
  const grandchildPath = write(dir, 'grandchild.js', 'module.exports = 1;');
  const childPath = write(dir, 'child.js', `module.exports = require('./grandchild.js');`);
  const rootPath = write(dir, 'root.js', `module.exports = require('./child.js');`);
  require(rootPath);
  try {
    const ids = cli.collectLocalRequireTree(rootPath);
    assert.ok(ids.has(require.resolve(grandchildPath)), `expected the two-levels-deep require() in ${JSON.stringify([...ids])}`);
  } finally {
    cleanupRequireCache(rootPath, childPath, grandchildPath);
  }
});

test('MIG-B4-02: collectLocalRequireTree excludes node_modules dependencies', () => {
  const dir = mkTmpDir();
  write(dir, 'node_modules/fake-dep/package.json', JSON.stringify({ name: 'fake-dep', main: 'index.js' }));
  const depPath = write(dir, 'node_modules/fake-dep/index.js', 'module.exports = 1;');
  const rootPath = write(dir, 'root.js', `module.exports = require('fake-dep');`);
  require(rootPath);
  try {
    const ids = cli.collectLocalRequireTree(rootPath);
    assert.ok(![...ids].some((id) => id.split(path.sep).includes('node_modules')), `expected no node_modules entry in ${JSON.stringify([...ids])}`);
  } finally {
    cleanupRequireCache(rootPath, depPath);
  }
});

test('MIG-B4-02: a uxdsl.config.cjs that requires another local module has that module in loadConfig\'s watch list', async () => {
  const dir = mkTmpDir();
  write(dir, 'real-config.js', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'uxdsl.config.cjs', `module.exports = require('./real-config.js');`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  const config = await cli.loadConfig({}, dir);
  const realConfigPath = path.join(dir, 'real-config.js');
  assert.ok(config.watch.includes(realConfigPath), `expected ${realConfigPath} in ${JSON.stringify(config.watch)}`);
});

test('MIG-B4-02: a uxdsl.theme.cjs that requires a nested JSON file has that file in loadConfig\'s watch list', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'theme-data.json', JSON.stringify({ palette: { primary: { main: '#123456' } } }));
  write(dir, 'uxdsl.theme.cjs', `module.exports = require('./theme-data.json');`);
  const config = await cli.loadConfig({}, dir);
  const themeDataPath = path.join(dir, 'theme-data.json');
  assert.ok(config.watch.includes(themeDataPath), `expected ${themeDataPath} in ${JSON.stringify(config.watch)}`);
});

test('MIG-B4-02: the theme/config file itself is still recorded using its own canonical path, not a resolved variant', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  const themePath = write(dir, 'uxdsl.theme.cjs', `module.exports = {};`);
  const config = await cli.loadConfig({}, dir);
  // Exact string match against what findThemeConfigPath/resolvePath produced
  // (config.themeConfigPath), not merely "some path resolving to the same
  // file" — a mismatch here (e.g. via require.resolve()'s realpath, which
  // differs from this on any /tmp-is-a-symlink system such as macOS) would
  // silently double-watch the same physical file under two spellings.
  assert.ok(config.watch.includes(config.themeConfigPath));
  assert.equal(config.watch.filter((w) => w === themePath).length, 1);
});

// --- MIG-B4-01 (FEAT-005): --strict-theme reachable from build/watch ---
// Reuses findPartiallyDefaultedFamilies/uxdslRuntime.resolveTheme, already
// built and tested for `uxdsl theme --strict` (MIG-B3-04) — no engine
// changes, just a new place to call the same check from.

test('MIG-B4-01: resolveStrictTheme — flag overrides config, config overrides the "off" default; a scope is always required', () => {
  assert.equal(cli.resolveStrictTheme(undefined, undefined), false);
  assert.deepEqual(cli.resolveStrictTheme(undefined, ['palette']), ['palette']);
  assert.deepEqual(cli.resolveStrictTheme('breakpoints', ['palette']), ['breakpoints']);
  assert.equal(cli.resolveStrictTheme(false, ['palette']), false, '--no-strict-theme wins over the config');
  assert.throws(() => cli.resolveStrictTheme(true, undefined), /--strict-theme needs a scope/);
  assert.throws(() => cli.resolveStrictTheme(undefined, true), /strictTheme \(in the config file\) needs a scope/);
});

test('MIG-B4-01: "strictTheme" in uxdsl.config.cjs reaches loadConfig\'s resolved config, overridden by --no-strict-theme', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', strictTheme: ['palette'] };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  const withConfig = await cli.loadConfig({}, dir);
  assert.deepEqual(withConfig.strictTheme, ['palette']);
  const withFlag = await cli.loadConfig({ 'strict-theme': false }, dir);
  assert.equal(withFlag.strictTheme, false);
});

test('MIG-B4-01: a "strictTheme" that is not an array of family names is a hard, actionable error', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', strictTheme: 'yes' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  await assert.rejects(() => cli.loadConfig({}, dir), /"strictTheme" must be an array of family names/);
});

test('MIG-B4-01: buildOnce with strictTheme: ["palette"] fails, before writing anything, when palette is partially defaulted', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', strictTheme: ['palette'] };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  const config = await cli.loadConfig({}, dir);
  // Only palette.primary.main declared — the rest of palette (dark/contrast,
  // surface, neutral, error) is left to DEFAULT_THEME.
  config.theme = { palette: { primary: { main: '#123456' } } };
  await assert.rejects(() => cli.buildOnce(config), /--strict-theme \(scoped to: palette\):.*palette/);
  assert.ok(!fs.existsSync(config.outFile));
});

test('MIG-B4-01: buildOnce with strictTheme: ["palette"] passes when every key of palette is explicit', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', strictTheme: ['palette'] };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  const config = await cli.loadConfig({}, dir);
  config.theme = { spacing: FULL_SPACING, palette: DEFAULT_THEME.palette };
  await cli.buildOnce(config); // Must not throw.
  assert.ok(fs.existsSync(config.outFile));
});

test('MIG-B4-01: buildOnce with strictTheme: ["palette"] passes when no theme is declared at all', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', strictTheme: ['palette'] };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  const config = await cli.loadConfig({}, dir);
  await cli.buildOnce(config); // zero-config — nothing declared, nothing "partial".
  assert.ok(fs.existsSync(config.outFile));
});

test('MIG-B4-01: buildOnce without strictTheme (default) does not fail on a partially declared family', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  const config = await cli.loadConfig({}, dir);
  config.theme = { palette: { primary: { main: '#123456' } } };
  await cli.buildOnce(config); // Must not throw — this is beta.2's own smooth-install feature.
  assert.ok(fs.existsSync(config.outFile));
});

test('MIG-B4-01: with a "builds" config, a shared partially-defaulted theme fails the whole build once, writing nothing', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = {
    builds: [
      { entry: './a.uxdsl', outFile: './a.css' },
      { entry: './b.uxdsl', outFile: './b.css', includeTheme: false },
    ],
    strictTheme: ['palette'],
  };`);
  write(dir, 'a.uxdsl', '');
  write(dir, 'b.uxdsl', '');
  const config = await cli.loadConfig({}, dir);
  config.theme = { palette: { primary: { main: '#123456' } } };
  await assert.rejects(() => cli.buildOnce(config), /--strict-theme \(scoped to: palette\):.*palette/);
  assert.ok(!fs.existsSync(config.builds[0].outFile));
  assert.ok(!fs.existsSync(config.builds[1].outFile));
});

// --- MIG-B5-01 (FEAT-006): --strict-theme/--strict scoped by family ---
// `strictTheme: true` checks every touched family, which turns out to
// conflict with the library's own documented partial-override pattern —
// verified for typography_details (the reported case), but also for
// palette (the postcss-uxdsl README's own celebrated example) and spacing
// (mig-b2-05-release's own fixture). The fix lets a project name which
// families it wants checked, instead of the tool guessing.

test('MIG-B5-01: normalizeStrictThemeScope — CSV string, array, the off switch, and "nothing here" all normalize correctly; true needs a scope', () => {
  assert.equal(cli.normalizeStrictThemeScope(undefined), undefined);
  assert.equal(cli.normalizeStrictThemeScope(null), undefined);
  assert.throws(() => cli.normalizeStrictThemeScope(true), /--strict-theme needs a scope/);
  assert.equal(cli.normalizeStrictThemeScope(false), false);
  assert.deepEqual(cli.normalizeStrictThemeScope('palette,breakpoints'), ['palette', 'breakpoints']);
  assert.deepEqual(cli.normalizeStrictThemeScope(' palette , breakpoints '), ['palette', 'breakpoints']);
  assert.deepEqual(cli.normalizeStrictThemeScope(['palette', 'breakpoints']), ['palette', 'breakpoints']);
  assert.equal(cli.normalizeStrictThemeScope(''), undefined);
  assert.equal(cli.normalizeStrictThemeScope([]), undefined);
});

test('MIG-B5-01: resolveStrictTheme — a scoped flag overrides a scoped config, unchanged precedence otherwise', () => {
  assert.equal(cli.resolveStrictTheme(undefined, undefined), false);
  assert.deepEqual(cli.resolveStrictTheme(undefined, ['palette']), ['palette']);
  assert.deepEqual(cli.resolveStrictTheme('palette,breakpoints', ['fonts']), ['palette', 'breakpoints'], 'a scoped flag overrides the config');
  assert.equal(cli.resolveStrictTheme(false, ['palette']), false, '--no-strict-theme always wins, scoped config or not');
});

test('MIG-B5-01: findPartiallyDefaultedFamilies with a scope only evaluates the intersection with touched families', () => {
  const raw = { palette: { primary: { main: '#123456' } }, typography_details: { h2: { fontSize: '2rem' } } };
  const effective = resolveThemeForTests(raw);
  assert.deepEqual(cli.findPartiallyDefaultedFamilies(raw, effective, ['palette']), ['palette'], 'typography_details is incomplete too, but out of scope');
  assert.deepEqual(cli.findPartiallyDefaultedFamilies(raw, effective, ['typography_details']), ['typography_details']);
  assert.deepEqual(cli.findPartiallyDefaultedFamilies(raw, effective, ['breakpoints']), [], 'breakpoints was never touched — nothing to flag even though it\'s in scope');
  assert.deepEqual(cli.findPartiallyDefaultedFamilies(raw, effective, true).sort(), ['palette', 'typography_details'], 'true (or omitted) keeps checking every touched family, unchanged');
});

test('MIG-B5-01: buildOnce with strictTheme scoped to ["palette"] passes despite a partial typography_details override', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', strictTheme: ['palette'] };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  const config = await cli.loadConfig({}, dir);
  assert.deepEqual(config.strictTheme, ['palette']);
  // The exact reported repro: a single documented partial override,
  // explicitly out of this project's chosen strict-theme scope.
  config.theme = { palette: DEFAULT_THEME.palette, typography_details: { h2: { fontSize: '2.2rem' } } };
  await cli.buildOnce(config); // Must not throw.
  assert.ok(fs.existsSync(config.outFile));
});

test('MIG-B5-01: buildOnce with strictTheme scoped to ["palette"] still fails when palette itself is partial', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', strictTheme: ['palette'] };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  const config = await cli.loadConfig({}, dir);
  config.theme = { palette: { primary: { main: '#123456' } }, typography_details: { h2: { fontSize: '2.2rem' } } };
  await assert.rejects(() => cli.buildOnce(config), /--strict-theme \(scoped to: palette\):.*palette/);
  assert.ok(!fs.existsSync(config.outFile));
});

test('MIG-B5-01: --strict-theme=<families> on the command line scopes the check the same way as the config array', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  const config = await cli.loadConfig({ 'strict-theme': 'palette' }, dir);
  assert.deepEqual(config.strictTheme, ['palette']);
  config.theme = { palette: DEFAULT_THEME.palette, typography_details: { h2: { fontSize: '2.2rem' } } };
  await cli.buildOnce(config); // Must not throw — typography_details is out of scope.
});

test('phase 2 (3): the bare flag and strictTheme: true are refused with the scoped form spelled out', async () => {
  // The unscoped check flagged every partial override — the theme model
  // itself — as incomplete, so it had no correct use and is not accepted.
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', strictTheme: true };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  await assert.rejects(
    () => cli.loadConfig({}, dir),
    /strictTheme \(in the config file\) needs a scope: name the families that must be completely declared, e\.g\. strictTheme: \['palette', 'breakpoints'\]/
  );
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  await assert.rejects(
    () => cli.loadConfig({ 'strict-theme': true }, dir),
    /--strict-theme needs a scope: name the families that must be completely declared, e\.g\. --strict-theme=palette,breakpoints/
  );
});

test('MIG-B5-01: a "strictTheme" that is not an array of strings is a hard, actionable error', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', strictTheme: 'palette' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  await assert.rejects(() => cli.loadConfig({}, dir), /"strictTheme" must be an array of family names/);
});

// --- MIG-B6-22 (FEAT-008): --strict-theme/--include-theme "=true"/"=false"
// string forms, unknown-family/unknown-flag suggestions, and per-command
// flag scoping. Before this story, minimist's undeclared-flag inference
// meant `--strict-theme=true`/`=false` were read as a *family named*
// "true"/"false" (never matches a real family, so the gate silently did
// nothing) and `--include-theme=false` was silently ignored (only a real
// boolean, from the bare flag or --no- negation, was ever accepted).

test('MIG-B6-22: normalizeStrictThemeScope never reads the strings "true"/"false" as family names — each gets its own answer', () => {
  assert.throws(() => cli.normalizeStrictThemeScope('true'), /--strict-theme needs a scope/);
  assert.throws(() => cli.normalizeStrictThemeScope('True'), /--strict-theme needs a scope/, 'case-insensitive');
  assert.throws(() => cli.normalizeStrictThemeScope('false'), /Invalid value for --strict-theme: "false"\. To turn the check off, omit it or pass --no-strict-theme\./);
  assert.throws(() => cli.normalizeStrictThemeScope('FALSE'), /pass --no-strict-theme/, 'case-insensitive');
  assert.deepEqual(cli.normalizeStrictThemeScope('palette,breakpoints'), ['palette', 'breakpoints'], 'unaffected: still a plain CSV family list');
});

test('MIG-B6-22: normalizeStrictThemeScope validates family names against knownFamilies and suggests a close match', () => {
  const knownFamilies = new Set(['palette', 'breakpoints', 'spacing']);
  assert.deepEqual(cli.normalizeStrictThemeScope('palette,breakpoints', { knownFamilies }), ['palette', 'breakpoints']);
  assert.throws(
    () => cli.normalizeStrictThemeScope('pallete', { knownFamilies }),
    /Unknown theme family "pallete" in --strict-theme\. Did you mean "palette"\?/
  );
  assert.throws(
    () => cli.normalizeStrictThemeScope('pallete', { knownFamilies, source: '--strict' }),
    /Unknown theme family "pallete" in --strict\. Did you mean "palette"\?/
  );
  // A typo too far from any known family gets no suggestion, not a wrong one.
  assert.throws(
    () => cli.normalizeStrictThemeScope('xyzxyz', { knownFamilies }),
    (err) => /Unknown theme family "xyzxyz" in --strict-theme\.$/.test(err.message)
  );
  // No knownFamilies passed at all (older postcss-uxdsl install without
  // KNOWN_THEME_FAMILIES) — validation is skipped entirely, matching every
  // pre-existing test above that calls this function with one argument.
  assert.deepEqual(cli.normalizeStrictThemeScope('pallete'), ['pallete']);
});

test('MIG-B6-22: resolveStrictTheme validates both the flag and the config value, labeling each source', () => {
  const knownFamilies = new Set(['palette']);
  assert.throws(
    () => cli.resolveStrictTheme('pallete', undefined, { knownFamilies }),
    /Unknown theme family "pallete" in --strict-theme/
  );
  assert.throws(
    () => cli.resolveStrictTheme(undefined, ['pallete'], { knownFamilies }),
    /Unknown theme family "pallete" in strictTheme \(in the config file\)/
  );
});

// --- MIG-B6-22 code-review fixes: an empty-after-split family list, a
// numeric --include-theme value, and a missing KNOWN_THEME_FAMILIES export
// each used to be silently accepted instead of rejected. ---

test('MIG-B6-22: normalizeStrictThemeScope rejects a stray comma instead of silently dropping the empty family and turning strict off', () => {
  const knownFamilies = new Set(['palette', 'fonts']);
  // A lone comma, or a value that is only commas/whitespace, must not be
  // treated the same as a genuinely empty value (`''`/`[]`, still "nothing
  // here" — see the true/false test above) — the user typed something,
  // and it parses to zero real family names, which is always a mistake.
  assert.throws(
    () => cli.normalizeStrictThemeScope(',', { knownFamilies }),
    /Invalid value for --strict-theme: ","\. A family list cannot contain an empty entry/
  );
  assert.throws(
    () => cli.normalizeStrictThemeScope('palette,,fonts', { knownFamilies }),
    /Invalid value for --strict-theme: "palette,,fonts"\. A family list cannot contain an empty entry/
  );
  assert.throws(
    () => cli.normalizeStrictThemeScope('palette,', { knownFamilies }),
    /A family list cannot contain an empty entry/,
    'a trailing comma must fail too, not just an internal one'
  );
  assert.throws(
    () => cli.normalizeStrictThemeScope(['palette', ''], { knownFamilies }),
    /A family list cannot contain an empty entry/,
    'the same rule applies to a config-provided array, not just the CLI CSV string'
  );
  // Still preserved: a truly empty value is "nothing here", not an error.
  assert.equal(cli.normalizeStrictThemeScope('', { knownFamilies }), undefined);
  assert.equal(cli.normalizeStrictThemeScope([], { knownFamilies }), undefined);
});

test('MIG-B6-22 (subprocess): --strict-theme=, and --strict-theme=palette,,fonts fail instead of silently disabling strict mode', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-cli-flags-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/a.uxdsl', outFile: './out/a.css' };");
  fs.writeFileSync(path.join(dir, 'src', 'a.uxdsl'), '.a { color: red; }\n');

  const lonelyComma = spawnSync(process.execPath, [CLI_BIN, 'build', '--strict-theme=,'], { cwd: dir, encoding: 'utf8' });
  assert.equal(lonelyComma.status, 1);
  assert.match(lonelyComma.stderr, /A family list cannot contain an empty entry/);

  const doubleComma = spawnSync(process.execPath, [CLI_BIN, 'build', '--strict-theme=palette,,fonts'], { cwd: dir, encoding: 'utf8' });
  assert.equal(doubleComma.status, 1);
  assert.match(doubleComma.stderr, /A family list cannot contain an empty entry/);
});

test('MIG-B6-22: resolveIncludeTheme rejects a number (minimist auto-parses --include-theme=0/=1 into a real number)', () => {
  assert.throws(() => cli.resolveIncludeTheme(0, undefined), /Invalid value for --include-theme: "0"/);
  assert.throws(() => cli.resolveIncludeTheme(1, undefined), /Invalid value for --include-theme: "1"/);
  assert.throws(() => cli.resolveIncludeTheme(0, true), /Invalid value for --include-theme: "0"/, 'an explicit invalid flag value must fail even when config would otherwise supply a valid one');
});

test('MIG-B6-22 (subprocess): --include-theme=0 is a hard error, not a silently-accepted "true"', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-cli-flags-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/a.uxdsl', outFile: './out/a.css' };");
  fs.writeFileSync(path.join(dir, 'src', 'a.uxdsl'), '.a { color: red; }\n');
  const result = spawnSync(process.execPath, [CLI_BIN, 'build', '--include-theme=0'], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[uxdsl\] Error: Invalid value for --include-theme: "0"/);
});

test('MIG-B6-22: normalizeStrictThemeScope reports an incompatible install instead of silently skipping family validation', () => {
  // requireKnownFamilies mirrors what loadConfig/themeCommand always pass:
  // a missing family list is an error, never a silently skipped check.
  assert.throws(
    () => cli.normalizeStrictThemeScope('palette', { knownFamilies: undefined, requireKnownFamilies: true }),
    /Cannot validate family names for --strict-theme: no list of known theme families was given/
  );
  // The off switch never needed family validation, so it's unaffected.
  assert.equal(cli.normalizeStrictThemeScope(false, { knownFamilies: undefined, requireKnownFamilies: true }), false);
  // Without requireKnownFamilies (the default every pre-existing/pure-parsing
  // test above relies on), skipping validation is still the documented
  // behavior — only the two real CLI call sites opt into requiring it.
  assert.deepEqual(cli.normalizeStrictThemeScope('palette', { knownFamilies: undefined }), ['palette']);
});

test('MIG-B6-22: resolveStrictTheme propagates requireKnownFamilies to both the flag and the config value', () => {
  assert.throws(
    () => cli.resolveStrictTheme('palette', undefined, { knownFamilies: undefined, requireKnownFamilies: true }),
    /Cannot validate family names for --strict-theme/
  );
  assert.throws(
    () => cli.resolveStrictTheme(undefined, ['palette'], { knownFamilies: undefined, requireKnownFamilies: true }),
    /Cannot validate family names for strictTheme \(in the config file\)/
  );
});

test('MIG-B6-22: --strict-theme=true (string) is refused like the bare flag, never read as a family named "true"', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  await assert.rejects(() => cli.loadConfig({ 'strict-theme': 'true' }, dir), /--strict-theme needs a scope/);
});

test('MIG-B6-22: --strict-theme=false (string) points at --no-strict-theme instead of reading as a family named "false"', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  await assert.rejects(() => cli.loadConfig({ 'strict-theme': 'false' }, dir), /pass --no-strict-theme/);
  const off = await cli.loadConfig({ 'strict-theme': false }, dir);
  assert.equal(off.strictTheme, false);
  off.theme = { typography_details: { h2: { fontSize: '2.2rem' } } };
  await cli.buildOnce(off); // Must not throw.
});

test('MIG-B6-22: loadConfig rejects an unknown family name in --strict-theme, with a suggestion', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  await assert.rejects(
    () => cli.loadConfig({ 'strict-theme': 'pallete' }, dir),
    /Unknown theme family "pallete" in --strict-theme\. Did you mean "palette"\?/
  );
});

test('MIG-B6-22: loadConfig rejects an unknown family name in "strictTheme" from uxdsl.config.cjs, with a suggestion', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', strictTheme: ['pallete'] };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  await assert.rejects(
    () => cli.loadConfig({}, dir),
    /Unknown theme family "pallete" in strictTheme \(in the config file\)\. Did you mean "palette"\?/
  );
});

test('MIG-B6-22: resolveIncludeTheme coerces the "true"/"false" strings --include-theme=<value> produces', () => {
  assert.equal(cli.resolveIncludeTheme('true', undefined), true);
  assert.equal(cli.resolveIncludeTheme('false', undefined), false);
  assert.equal(cli.resolveIncludeTheme('false', true), false, 'the CLI flag still overrides config');
});

test('MIG-B6-22: resolveIncludeTheme rejects any other string instead of silently reading it as truthy', () => {
  assert.throws(
    () => cli.resolveIncludeTheme('banana', undefined),
    /Invalid value for --include-theme: "banana"\. Expected true or false \(or --no-include-theme\)\./
  );
});

test('MIG-B6-22: loadConfig with --include-theme=false emits zero :root definitions, same as --no-include-theme', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  const config = await cli.loadConfig({ 'include-theme': 'false' }, dir);
  assert.equal(config.includeTheme, false);
});

// --- MIG-B6-22: parseCommandArgv — per-command flag scoping and unknown
// flag/family detection. These exercise the same function main() calls,
// without spawning a subprocess for every case.

test('MIG-B6-22: parseCommandArgv reads the command from the first non-flag token and never lets an unknown flag eat it', () => {
  const { cmd, argv } = cli.parseCommandArgv(['build', '--entry', 'x.uxdsl']);
  assert.equal(cmd, 'build');
  assert.equal(argv.entry, 'x.uxdsl');
});

test('phase 2 (3): parseCommandArgv with no command accepts only the global flags — a build flag alone is not a silent build', () => {
  assert.equal(cli.parseCommandArgv([]).cmd, undefined);
  assert.equal(cli.parseCommandArgv(['--help']).argv.help, true);
  assert.equal(cli.parseCommandArgv(['-v']).argv.version, true);
  assert.throws(() => cli.parseCommandArgv(['--strict-theme=palette']), /No command given \(got "--strict-theme=palette"\)\. To compile, run "uxdsl build \.\.\."/);
  assert.throws(() => cli.parseCommandArgv(['--entry', 'x.uxdsl']), /No command given/);
});

test('MIG-B6-22: parseCommandArgv rejects a mistyped flag with a suggestion, scoped to that command\'s own flags', () => {
  assert.throws(
    () => cli.parseCommandArgv(['build', '--strict-thme']),
    /Unknown option --strict-thme\. Did you mean --strict-theme\?/
  );
});

test('MIG-B6-22: parseCommandArgv rejects a flag that is valid for a different command', () => {
  assert.throws(() => cli.parseCommandArgv(['build', '--strict']), /Unknown option --strict\.$/);
  assert.throws(() => cli.parseCommandArgv(['theme', '--watch']), /Unknown option --watch\.$/);
});

test('MIG-B6-22: parseCommandArgv does not treat a positional argument as an unknown flag', () => {
  const { argv } = cli.parseCommandArgv(['generate-entry', '--src', './src', 'not-a-flag']);
  assert.deepEqual(argv._, ['not-a-flag']);
});

test('MIG-B6-22: parseCommandArgv skips flag validation for an unrecognized command, leaving "Unknown command" as the only error', () => {
  const { cmd } = cli.parseCommandArgv(['bogus', '--whatever']);
  assert.equal(cmd, 'bogus'); // main()'s switch reports "Unknown command: bogus" for this, not a flag error.
});

test('MIG-B6-22: parseCommandArgv resolves a repeated flag to its last occurrence, not an array', () => {
  assert.equal(cli.parseCommandArgv(['build', '--entry', 'a', '--entry', 'b']).argv.entry, 'b');
  assert.equal(cli.parseCommandArgv(['build', '--include-theme=true', '--include-theme=false']).argv['include-theme'], 'false');
  const viaAlias = cli.parseCommandArgv(['build', '-e', 'a', '-e', 'b']);
  assert.equal(viaAlias.argv.entry, 'b');
  assert.equal(viaAlias.argv.e, 'b');
});

test('MIG-B6-22: parseCommandArgv still accepts --no-include-theme and --no-strict-theme (manual flags keep their negation form)', () => {
  const { argv } = cli.parseCommandArgv(['build', '--no-include-theme', '--no-strict-theme']);
  assert.equal(argv['include-theme'], false);
  assert.equal(argv['strict-theme'], false);
});

test('MIG-B6-22: parseCommandArgv reports every unknown flag when more than one is passed', () => {
  assert.throws(() => cli.parseCommandArgv(['build', '--bogus1', '--bogus2']), /Unknown option --bogus1\.[\s\S]*Unknown option --bogus2\./);
});

// --- MIG-B6-22: end-to-end through the real subprocess (main()'s own
// process.exit/console.error wiring isn't exercised by any function-level
// test above), covering exactly the table in the story's "Resultado
// esperado" section.

test('MIG-B6-22 (subprocess): --strict-thme (typo) fails with exit 1 and a suggestion', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-cli-flags-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/a.uxdsl', outFile: './out/a.css' };");
  fs.writeFileSync(path.join(dir, 'src', 'a.uxdsl'), '.a { color: red; }\n');
  const result = spawnSync(process.execPath, [CLI_BIN, 'build', '--strict-thme'], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[uxdsl\] Error: Unknown option --strict-thme\. Did you mean --strict-theme\?/);
});

test('MIG-B6-22 (subprocess): --strict-theme=pallete (typo family) fails with exit 1 and a suggestion', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-cli-flags-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/a.uxdsl', outFile: './out/a.css' };");
  fs.writeFileSync(path.join(dir, 'src', 'a.uxdsl'), '.a { color: red; }\n');
  const result = spawnSync(process.execPath, [CLI_BIN, 'build', '--strict-theme=pallete'], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[uxdsl\] Error: Unknown theme family "pallete" in --strict-theme\. Did you mean "palette"\?/);
});

test('phase 2 (3, subprocess): --strict-theme needs a scope; =true and the bare flag are refused, =false points at --no-strict-theme, the scoped form runs the check', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-cli-flags-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/a.uxdsl', outFile: './out/a.css' };");
  fs.writeFileSync(path.join(dir, 'uxdsl.theme.cjs'), "module.exports = { palette: { primary: { main: '#00aa00' } } };");
  fs.writeFileSync(path.join(dir, 'src', 'a.uxdsl'), '.a { color: palette(primary); }\n');
  const run = (...args) => spawnSync(process.execPath, [CLI_BIN, ...args], { cwd: dir, encoding: 'utf8' });

  const bare = run('build', '--strict-theme');
  assert.equal(bare.status, 1);
  assert.match(bare.stderr, /\[uxdsl\] Error: --strict-theme needs a scope: name the families that must be completely declared, e\.g\. --strict-theme=palette,breakpoints/);
  assert.equal(fs.existsSync(path.join(dir, 'out', 'a.css')), false, 'refused before anything is written');
  const trueString = run('build', '--strict-theme=true');
  assert.equal(trueString.status, 1);
  assert.match(trueString.stderr, /needs a scope/);

  const falseString = run('build', '--strict-theme=false');
  assert.equal(falseString.status, 1);
  assert.match(falseString.stderr, /pass --no-strict-theme/);
  const off = run('build', '--no-strict-theme');
  assert.equal(off.status, 0, off.stderr);

  const scoped = run('build', '--strict-theme=palette');
  assert.equal(scoped.status, 1, 'palette is partially declared, so the scoped check fails');
  assert.match(scoped.stderr, /--strict-theme \(scoped to: palette\):.*palette/);
  const elsewhere = run('build', '--strict-theme=breakpoints');
  assert.equal(elsewhere.status, 0, `breakpoints is untouched, so nothing is partial: ${elsewhere.stderr}`);
});

test('MIG-B6-22 (subprocess): --include-theme=false emits zero :root definitions, matching --no-include-theme', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-cli-flags-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/a.uxdsl', outFile: './out/a.css' };");
  fs.writeFileSync(path.join(dir, 'src', 'a.uxdsl'), '.a { color: red; }\n');

  const equalsFalse = spawnSync(process.execPath, [CLI_BIN, 'build', '--include-theme=false'], { cwd: dir, encoding: 'utf8' });
  assert.equal(equalsFalse.status, 0, equalsFalse.stderr);
  assert.equal((fs.readFileSync(path.join(dir, 'out', 'a.css'), 'utf8').match(/:root/g) || []).length, 0);

  const noFlag = spawnSync(process.execPath, [CLI_BIN, 'build', '--no-include-theme'], { cwd: dir, encoding: 'utf8' });
  assert.equal(noFlag.status, 0, noFlag.stderr);
  assert.equal((fs.readFileSync(path.join(dir, 'out', 'a.css'), 'utf8').match(/:root/g) || []).length, 0, 'control: --no-include-theme already worked before this fix');
});

test('MIG-B6-22 (subprocess): --include-theme=banana is a hard error, not a silent true', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-cli-flags-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/a.uxdsl', outFile: './out/a.css' };");
  fs.writeFileSync(path.join(dir, 'src', 'a.uxdsl'), '.a { color: red; }\n');
  const result = spawnSync(process.execPath, [CLI_BIN, 'build', '--include-theme=banana'], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[uxdsl\] Error: Invalid value for --include-theme: "banana"/);
});

test('MIG-B6-22 (subprocess): a flag valid for another command fails as unknown for this one', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-cli-flags-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/a.uxdsl', outFile: './out/a.css' };");
  fs.writeFileSync(path.join(dir, 'src', 'a.uxdsl'), '.a { color: red; }\n');
  const result = spawnSync(process.execPath, [CLI_BIN, 'build', '--strict'], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[uxdsl\] Error: Unknown option --strict\.$/m);
});

// --- MIG-B5-02 (FEAT-006): unknown theme family warnings, surfaced from a
// real build --- `validateTheme`'s "Unknown theme family"
// warning (MIG-B3-03) was never actually reachable from `uxdsl build`
// before this — only the playground's theme editor called that function at
// all. MIG-B5-02 also shipped a parallel "Unknown <family> key" warning one
// level deeper (typography_details/palette/fonts.families); MIG-B6-01
// (FEAT-007) removed that one — none of those three families has a real
// closed set to check a key against, so it produced false positives for
// any project with a richer palette/fonts/typography set than
// DEFAULT_THEME's minimal fallback. Test names below use unique,
// test-scoped family/tag names so the module-level dedup Set (shared
// across every test in this process) never causes one test to see a
// warning already consumed by an earlier one.

test('MIG-B5-02: warnUnknownThemeKeys prints an unknown top-level family', () => {
  const { messages } = captureWarnings(() =>
    cli.warnUnknownThemeKeys({ migB502UnknownFamilyA: { x: 1 } })
  );
  assert.ok(messages.some((m) => /Unknown theme family "migB502UnknownFamilyA"/.test(m)), JSON.stringify(messages));
});

test('MIG-B6-01: warnUnknownThemeKeys does not warn on a typography_details tag beyond DEFAULT_THEME\'s built-ins (regression)', () => {
  const { messages } = captureWarnings(() =>
    cli.warnUnknownThemeKeys({ typography_details: { migB601CustomTag: { fontSize: '1rem' } } })
  );
  assert.deepEqual(messages, []);
});

test('MIG-B6-01: warnUnknownThemeKeys recognizes modes and typography but still warns on a typo', () => {
  const { messages } = captureWarnings(() =>
    cli.warnUnknownThemeKeys({
      modes: { dark: { palette: { primary: { main: '#000000' } } } },
      typography: { hero: '2rem' },
      migB601PaleteTypo: {},
    })
  );
  assert.equal(messages.length, 1);
  assert.match(messages[0], /Unknown theme family "migB601PaleteTypo"/);
});

test('MIG-B5-02: warnUnknownThemeKeys is a no-op for an undefined theme (zero-config)', () => {
  const { messages } = captureWarnings(() => cli.warnUnknownThemeKeys(undefined));
  assert.deepEqual(messages, []);
});

test('MIG-B5-02: warnUnknownThemeKeys deduplicates the identical message across repeated calls', () => {
  const theme = { migB502UnknownFamilyB: { x: 1 } };
  const { messages: first } = captureWarnings(() => cli.warnUnknownThemeKeys(theme));
  assert.equal(first.length, 1);
  const { messages: second } = captureWarnings(() => cli.warnUnknownThemeKeys(theme));
  assert.deepEqual(second, [], 'the identical warning must not reprint on a second call (watch-mode rebuild)');
});

test('MIG-B5-02: a real buildOnce surfaces the warning for an unknown theme family declared in uxdsl.config.cjs', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  const config = await cli.loadConfig({}, dir);
  config.theme = { migB502UnknownFamilyC: { x: 1 } };
  const { messages } = await captureWarningsAsync(() => cli.buildOnce(config));
  assert.ok(messages.some((m) => /Unknown theme family "migB502UnknownFamilyC"/.test(m)), JSON.stringify(messages));
  assert.ok(fs.existsSync(config.outFile), 'an unknown-family warning must not block the build');
});

// MIG-B6-23 (FEAT-008): fast, direct unit coverage of the atomic
// commit helpers — the slow, real-chokidar end-to-end scenarios live in
// watch-mode.test.js instead.

test('MIG-B6-23: commitFileIfChanged writes a new file and reports "written"', () => {
  const dir = mkTmpDir();
  const outFile = path.join(dir, 'out.css');
  const status = cli.commitFileIfChanged(outFile, '.a { color: red; }');
  assert.equal(status, 'written');
  assert.equal(fs.readFileSync(outFile, 'utf8'), '.a { color: red; }');
});

test('MIG-B6-23: commitFileIfChanged reports "unchanged" and does not touch mtime/inode for identical content', () => {
  const dir = mkTmpDir();
  const outFile = write(dir, 'out.css', '.a { color: red; }');
  const before = fs.statSync(outFile);
  const status = cli.commitFileIfChanged(outFile, '.a { color: red; }');
  const after = fs.statSync(outFile);
  assert.equal(status, 'unchanged');
  assert.equal(after.mtimeMs, before.mtimeMs);
  assert.equal(after.ino, before.ino);
});

test('MIG-B6-23: commitFileIfChanged replaces different content atomically (rename, not in-place truncation) and leaves no temp file behind', () => {
  const dir = mkTmpDir();
  const outFile = write(dir, 'out.css', '.a { color: red; }');
  const status = cli.commitFileIfChanged(outFile, '.a { color: blue; }');
  assert.equal(status, 'written');
  assert.equal(fs.readFileSync(outFile, 'utf8'), '.a { color: blue; }');
  const leftovers = fs.readdirSync(dir).filter((f) => f.includes('.tmp'));
  assert.deepEqual(leftovers, [], 'no temp file should remain after a successful commit');
});

test('MIG-B6-23: commitFileIfChanged creates the output directory if missing', () => {
  const dir = mkTmpDir();
  const outFile = path.join(dir, 'nested', 'deep', 'out.css');
  const status = cli.commitFileIfChanged(outFile, '.a {}');
  assert.equal(status, 'written');
  assert.equal(fs.readFileSync(outFile, 'utf8'), '.a {}');
});

test('MIG-B6-23: commitCompiled writes only the entries whose content actually changed', () => {
  const dir = mkTmpDir();
  const aFile = write(dir, 'a.css', '.a { color: red; }');
  const bFile = write(dir, 'b.css', '.b { color: green; }');
  const statuses = cli.commitCompiled([
    { outFile: aFile, finalCss: '.a { color: red; }' }, // unchanged
    { outFile: bFile, finalCss: '.b { color: blue; }' }, // changed
  ]);
  assert.deepEqual(statuses, ['unchanged', 'written']);
  assert.equal(fs.readFileSync(bFile, 'utf8'), '.b { color: blue; }');
});

test('MIG-B6-23: commitCompiled rolls back every entry it already wrote if a later commit in the same call fails', () => {
  const dir = mkTmpDir();
  const aFile = write(dir, 'a.css', '.a { color: red; }');
  // A directory in place of the "file" for the second entry — its rename
  // will fail (EISDIR/ENOTEMPTY depending on platform), simulating a
  // commit failing partway through a multi-entry batch.
  const bFile = path.join(dir, 'b.css');
  fs.mkdirSync(bFile);
  fs.writeFileSync(path.join(bFile, 'keep-dir-nonempty'), 'x');

  assert.throws(() => cli.commitCompiled([
    { outFile: aFile, finalCss: '.a { color: NEW; }' },
    { outFile: bFile, finalCss: '.b { color: blue; }' },
  ]));

  assert.equal(fs.readFileSync(aFile, 'utf8'), '.a { color: red; }', "a.css must be rolled back to its pre-build content after b's commit fails");
  const leftovers = fs.readdirSync(dir).filter((f) => f.includes('.tmp'));
  assert.deepEqual(leftovers, [], 'no temp file should remain after a rolled-back commit');
});

test('MIG-B6-23: commitCompiled removes (does not leave stale content in) an entry that did not exist before a failed rollback', () => {
  const dir = mkTmpDir();
  const aFile = path.join(dir, 'a.css'); // Does not exist yet.
  const bFile = path.join(dir, 'b.css');
  fs.mkdirSync(bFile);
  fs.writeFileSync(path.join(bFile, 'keep-dir-nonempty'), 'x');

  assert.throws(() => cli.commitCompiled([
    { outFile: aFile, finalCss: '.a { color: red; }' },
    { outFile: bFile, finalCss: '.b { color: blue; }' },
  ]));

  assert.equal(fs.existsSync(aFile), false, 'a.css did not exist before this build, and must not exist after the rollback either');
});

test('MIG-B6-23: bootstrapWatchTargets includes every config/theme candidate plus an explicit --config/--entry, resolved against cwd', () => {
  const dir = mkTmpDir();
  const targets = cli.bootstrapWatchTargets({ config: './my-config.cjs' }, dir);
  for (const candidate of cli.CONFIG_CANDIDATES) assert.ok(targets.includes(path.join(dir, candidate)), candidate);
  for (const candidate of cli.THEME_CANDIDATES) assert.ok(targets.includes(path.join(dir, candidate)), candidate);
  assert.ok(targets.includes(path.join(dir, 'my-config.cjs')));
});

test('MIG-B6-23: loadAndBuildForWatch(argv, false) rethrows a loadConfig failure (a one-shot "build" still exits non-zero)', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', 'module.exports = { this is not valid javascript');
  await assert.rejects(() => cli.loadAndBuildForWatch({ config: path.join(dir, 'uxdsl.config.cjs') }, false));
});

test('MIG-B6-23: loadAndBuildForWatch(argv, true) swallows a loadConfig failure and returns null instead of throwing', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', 'module.exports = { this is not valid javascript');
  const config = await cli.loadAndBuildForWatch({ config: path.join(dir, 'uxdsl.config.cjs') }, true);
  assert.equal(config, null);
});

test('MIG-B6-23: loadAndBuildForWatch(argv, true) swallows a compile failure but still returns the loaded config', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.a { color: palette(does-not-exist); }');
  const config = await cli.loadAndBuildForWatch({ config: path.join(dir, 'uxdsl.config.cjs') }, true);
  assert.ok(config, 'a compile failure must not prevent the loaded config from being returned to startWatch');
  assert.equal(fs.existsSync(path.join(dir, 'src', 'out.css')), false, 'nothing should have been written for a build that failed to compile');
});

// MIG-B6-24 (FEAT-008): a builds[] entry that would emit :root into a
// *.module.css output fails before anything is written; more than one entry
// emitting the theme at all is a warning, not an error.

test('MIG-B6-24: findThemeLeakSelector finds a real :root rule, not text inside a string or comment', () => {
  assert.equal(cli.findThemeLeakSelector(':root { --x: 1; }'), ':root');
  // The removed breakpoint marker is an ordinary rule now, not a theme leak.
  assert.equal(cli.findThemeLeakSelector('#uxdsl-bp-meta { display: none; }'), null);
  assert.equal(cli.findThemeLeakSelector('.a, :root { color: red; }'), ':root', 'must catch :root inside a compound comma-separated selector');
  assert.equal(cli.findThemeLeakSelector('/* mentions :root in a comment */\n.a { color: red; }'), null);
  assert.equal(cli.findThemeLeakSelector('.a::before { content: ":root example"; }'), null);
  assert.equal(cli.findThemeLeakSelector('.a { color: red; }'), null);
});

test('MIG-B6-24: the exact reproduction fails before writing, naming the offending entry', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { builds: [
    { entry: './src/theme.uxdsl', outFile: './out/theme.css' },
    { entry: './src/panel.uxdsl', outFile: './out/panel.module.css' },
  ] };`);
  write(dir, 'src/theme.uxdsl', '');
  write(dir, 'src/panel.uxdsl', '.p { padding: density(2); }\n');
  const config = await cli.loadConfig({}, dir);
  await assert.rejects(
    () => cli.buildOnce(config),
    /builds\[1\] \(.*panel\.module\.css\): this entry would emit :root, which CSS Modules reject \("Selector :root is not pure"\)\. Set includeTheme: false for component entries\./
  );
  assert.equal(fs.existsSync(path.join(dir, 'out')), false, 'nothing must be written, including the other, unrelated entry');
});

test('MIG-B6-24: a .module.css entry with includeTheme: false compiles without error', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { builds: [
    { entry: './src/theme.uxdsl', outFile: './out/theme.css' },
    { entry: './src/panel.uxdsl', outFile: './out/panel.module.css', includeTheme: false },
  ] };`);
  write(dir, 'src/theme.uxdsl', '');
  write(dir, 'src/panel.uxdsl', '.p { padding: density(2); }\n');
  const config = await cli.loadConfig({}, dir);
  await cli.buildOnce(config); // Must not throw.
  assert.ok(fs.existsSync(path.join(dir, 'out', 'panel.module.css')));
});

test('MIG-B6-24: includeTheme: false does not exempt a .module.css entry whose own content still defines :root (e.g. explicit native CSS)', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/panel.uxdsl', outFile: './out/panel.module.css', includeTheme: false };`);
  write(dir, 'src/panel.uxdsl', ':root { --leaked: 1; }\n.p { color: red; }');
  const config = await cli.loadConfig({}, dir);
  await assert.rejects(() => cli.buildOnce(config), /this entry would emit :root, which CSS Modules reject/);
});

test('MIG-B6-24: two .css entries that both emit the theme warn exactly once, naming both', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { builds: [
    { entry: './src/a.uxdsl', outFile: './out/a.css' },
    { entry: './src/b.uxdsl', outFile: './out/b.css' },
  ] };`);
  write(dir, 'src/a.uxdsl', '.a { color: red; }');
  write(dir, 'src/b.uxdsl', '.b { color: blue; }');
  const config = await cli.loadConfig({}, dir);
  const { messages } = await captureWarningsAsync(() => cli.buildOnce(config));
  const relevant = messages.filter((m) => /entries emit the theme/.test(m));
  assert.equal(relevant.length, 1, JSON.stringify(messages));
  assert.match(relevant[0], /2 entries emit the theme \(builds\[0\], builds\[1\]\); usually only one theme entry should\./);
});

test('MIG-B6-24: a single entry with --out ending in .module.css fails; --no-include-theme fixes it', async () => {
  const dir = mkTmpDir();
  write(dir, 'src/panel.uxdsl', '.p { padding: density(2); }\n');
  const failing = await cli.loadConfig({ entry: './src/panel.uxdsl', out: './out/x.module.css' }, dir);
  await assert.rejects(() => cli.buildOnce(failing), /this entry would emit :root, which CSS Modules reject/);

  const passing = await cli.loadConfig({ entry: './src/panel.uxdsl', out: './out/x.module.css', 'include-theme': false }, dir);
  await cli.buildOnce(passing); // Must not throw.
  assert.ok(fs.existsSync(path.join(dir, 'out', 'x.module.css')));
});

// --- MIG-B6-21 (FEAT-008): source maps ---

function mkSourceMapProject(configExtra = '') {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-cli-map-')));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'entry.uxdsl'), '.plain { color: red; }\n.spaced { padding: density(4); }\n');
  fs.writeFileSync(
    path.join(dir, 'uxdsl.config.cjs'),
    `module.exports = { entry: 'src/entry.uxdsl', outFile: 'dist/css/out.css'${configExtra} };\n`
  );
  return dir;
}

test('MIG-B6-21: --sourcemap writes an external .map, annotates the CSS last, and reports both sizes', () => {
  const dir = mkSourceMapProject();
  const result = spawnSync(process.execPath, [CLI_BIN, 'build', '--sourcemap'], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const cssPath = path.join(dir, 'dist', 'css', 'out.css');
  const mapPath = `${cssPath}.map`;
  assert.ok(fs.existsSync(mapPath), 'external mode writes <outFile>.map');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.trimEnd().endsWith('/*# sourceMappingURL=out.css.map */'), 'the annotation must be the last thing in the file');
  assert.equal(JSON.parse(fs.readFileSync(mapPath, 'utf8')).version, 3);
  // The log separates CSS bytes from map bytes.
  assert.match(result.stdout, /built .*out\.css \(\d+ bytes\) \+ out\.css\.map \(\d+ bytes\)/);
});

test('MIG-B6-21: --sourcemap=inline embeds a data URI and writes no .map', () => {
  const dir = mkSourceMapProject();
  const result = spawnSync(process.execPath, [CLI_BIN, 'build', '--sourcemap=inline'], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const css = fs.readFileSync(path.join(dir, 'dist', 'css', 'out.css'), 'utf8');
  assert.match(css, /sourceMappingURL=data:application\/json;charset=utf-8;base64,/);
  assert.equal(fs.existsSync(path.join(dir, 'dist', 'css', 'out.css.map')), false, 'inline writes no .map file');
});

test('MIG-B6-21: no sourcemap option produces byte-identical CSS to --no-sourcemap, and no map', () => {
  const dir = mkSourceMapProject();
  assert.equal(spawnSync(process.execPath, [CLI_BIN, 'build'], { cwd: dir, encoding: 'utf8' }).status, 0);
  const plain = fs.readFileSync(path.join(dir, 'dist', 'css', 'out.css'), 'utf8');

  const dir2 = mkSourceMapProject();
  assert.equal(spawnSync(process.execPath, [CLI_BIN, 'build', '--no-sourcemap'], { cwd: dir2, encoding: 'utf8' }).status, 0);
  assert.equal(fs.readFileSync(path.join(dir2, 'dist', 'css', 'out.css'), 'utf8'), plain);
  assert.equal(fs.existsSync(path.join(dir2, 'dist', 'css', 'out.css.map')), false);
});

test('MIG-B6-21: switching external -> off retires that output\'s own map, but never a foreign file at that path', () => {
  const dir = mkSourceMapProject();
  assert.equal(spawnSync(process.execPath, [CLI_BIN, 'build', '--sourcemap'], { cwd: dir, encoding: 'utf8' }).status, 0);
  const mapPath = path.join(dir, 'dist', 'css', 'out.css.map');
  assert.ok(fs.existsSync(mapPath));

  // Ours: retired on the next non-external build.
  assert.equal(spawnSync(process.execPath, [CLI_BIN, 'build', '--no-sourcemap'], { cwd: dir, encoding: 'utf8' }).status, 0);
  assert.equal(fs.existsSync(mapPath), false, 'a map this tool wrote is retired when the mode changes');

  // Not ours: same path, but not a source map — must survive untouched.
  fs.writeFileSync(mapPath, 'notes that happen to live at this path\n');
  assert.equal(spawnSync(process.execPath, [CLI_BIN, 'build', '--no-sourcemap'], { cwd: dir, encoding: 'utf8' }).status, 0);
  assert.equal(fs.readFileSync(mapPath, 'utf8'), 'notes that happen to live at this path\n');
});

test('MIG-B6-21: the config option works and the flag overrides it', () => {
  const dir = mkSourceMapProject(", sourcemap: 'external'");
  assert.equal(spawnSync(process.execPath, [CLI_BIN, 'build'], { cwd: dir, encoding: 'utf8' }).status, 0);
  assert.ok(fs.existsSync(path.join(dir, 'dist', 'css', 'out.css.map')), 'config alone enables it');

  assert.equal(spawnSync(process.execPath, [CLI_BIN, 'build', '--no-sourcemap'], { cwd: dir, encoding: 'utf8' }).status, 0);
  assert.equal(fs.existsSync(path.join(dir, 'dist', 'css', 'out.css.map')), false, 'the flag wins over the config');
});

test('MIG-B6-21: an invalid sourcemap value fails loudly instead of silently emitting nothing', () => {
  const dir = mkSourceMapProject();
  const flag = spawnSync(process.execPath, [CLI_BIN, 'build', '--sourcemap=yes'], { cwd: dir, encoding: 'utf8' });
  assert.equal(flag.status, 1);
  assert.match(flag.stderr, /Invalid value for --sourcemap: "yes"/);

  const badConfig = mkSourceMapProject(", sourcemap: 'External'");
  const cfg = spawnSync(process.execPath, [CLI_BIN, 'build'], { cwd: badConfig, encoding: 'utf8' });
  assert.equal(cfg.status, 1);
  assert.match(cfg.stderr, /"sourcemap" must be false, "inline" or "external"/);
});

test('phase 2 (3): the config key is spelled "sourcemap", like the flag; "sourceMap" is rejected with the spelling', () => {
  const dir = mkSourceMapProject(", sourceMap: 'external'");
  const result = spawnSync(process.execPath, [CLI_BIN, 'build'], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /"sourceMap" is not a build-config key any more — the key is spelled "sourcemap", like the --sourcemap flag/);
  assert.equal(fs.existsSync(path.join(dir, 'dist')), false);
});

test('MIG-B6-21: a multi-entry build that fails writes neither CSS nor map for any entry', () => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-cli-map-')));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'a.uxdsl'), '.ok { color: red; }\n');
  fs.writeFileSync(path.join(dir, 'src', 'b.uxdsl'), '.bad { padding: density(999); }\n');
  fs.writeFileSync(
    path.join(dir, 'uxdsl.config.cjs'),
    "module.exports = { builds: [\n" +
    "  { entry: 'src/a.uxdsl', outFile: 'dist/a.css' },\n" +
    "  { entry: 'src/b.uxdsl', outFile: 'dist/b.css', includeTheme: false },\n" +
    "] };\n"
  );
  const result = spawnSync(process.execPath, [CLI_BIN, 'build', '--sourcemap'], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 1);
  const written = fs.existsSync(path.join(dir, 'dist')) ? fs.readdirSync(path.join(dir, 'dist')) : [];
  assert.deepEqual(written, [], `a failing entry must leave nothing written, found: ${written.join(', ')}`);
});

test('MIG-B6-21: resolveSourceMap precedence is flag > config > false', () => {
  const { resolveSourceMap } = require('../../bin/uxdsl.js');
  assert.equal(resolveSourceMap(undefined, undefined), false);
  assert.equal(resolveSourceMap(undefined, 'inline'), 'inline');
  assert.equal(resolveSourceMap(true, 'inline'), 'external', 'a bare --sourcemap means external and overrides the config');
  assert.equal(resolveSourceMap(false, 'external'), false, '--no-sourcemap overrides the config');
  assert.equal(resolveSourceMap('inline', 'external'), 'inline');
  // minimist turns `--sourcemap=0` into the number 0, which must not read as a mode.
  assert.throws(() => resolveSourceMap(0, undefined), /Invalid value for --sourcemap/);
  assert.throws(() => resolveSourceMap('yes', undefined), /Invalid value for --sourcemap/);
});

test('MIG-B7-15: a rebuild with identical output says what "unchanged" means, and a changed output still says "built"', () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', "module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };\n");
  write(dir, 'src/entry.uxdsl', '.a { color: red; }\n');
  const build = () => spawnSync(process.execPath, [CLI_BIN, 'build'], { cwd: dir, encoding: 'utf8' });
  const first = build();
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /\[uxdsl\] built src[\\/]out\.css \(\d+ bytes\)/);
  const second = build();
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /^\[uxdsl\] unchanged src[\\/]out\.css \(compiled output identical to the file on disk; not rewritten\)$/m);
  // Control: a hand-edited output file is not "unchanged" — it is rebuilt.
  fs.appendFileSync(path.join(dir, 'src', 'out.css'), '/* edited by hand */\n');
  const third = build();
  assert.match(third.stdout, /\[uxdsl\] built src[\\/]out\.css/);
  assert.doesNotMatch(third.stdout, /unchanged/);
});

// --- Stability phase 2 (3): the command surface — one way to do each thing,
// help per command, a version, and a bare `uxdsl` that asks instead of building.

function cliProject() {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', "module.exports = { entry: './src/a.uxdsl', outFile: './out/a.css' };\n");
  write(dir, 'src/a.uxdsl', '.a { color: red; }\n');
  return dir;
}

const runCli = (dir, ...args) => spawnSync(process.execPath, [CLI_BIN, ...args], { cwd: dir, encoding: 'utf8' });

test('phase 2 (3): bare `uxdsl` prints the general help and exits 0, and builds nothing', () => {
  const dir = cliProject();
  const result = runCli(dir);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^Usage: uxdsl <command> \[options\]/);
  assert.match(result.stdout, /\n  build {2,}/);
  assert.doesNotMatch(result.stdout, /\n  watch {2,}/, 'watch is not a command');
  assert.equal(fs.existsSync(path.join(dir, 'out')), false, 'nothing was compiled');
  assert.equal(runCli(dir, '--help').stdout, result.stdout);
  assert.equal(runCli(dir, '-h').stdout, result.stdout);
});

test('phase 4: `uxdsl --version` prints the one package version, nothing else', () => {
  // One package: the CLI, the compiler and the theme model are the same
  // install, so there is exactly one version to report.
  const dir = cliProject();
  const result = runCli(dir, '--version');
  assert.equal(result.status, 0, result.stderr);
  const version = require('../../package.json').version;
  assert.equal(result.stdout, `uxdsl ${version}\n`);
  assert.equal(runCli(dir, '-v').stdout, result.stdout);
});

test('phase 4: the CLI resolves nothing from the project — it compiles with the package it ships in', () => {
  const source = fs.readFileSync(CLI_BIN, 'utf8');
  assert.doesNotMatch(source, /createRequire|resolveUxDslModule|postcss-uxdsl|uxdsl-core/);
  assert.match(source, /require\('\.\.\/dist\/compile'\)/);
});

test('phase 2 (3): `uxdsl <command> --help` prints that command\'s options and nothing else', () => {
  const dir = cliProject();
  const build = runCli(dir, 'build', '--help');
  assert.equal(build.status, 0);
  assert.match(build.stdout, /^Usage: uxdsl build \[options\]/);
  for (const flag of ['--config', '--entry', '--out', '--watch', '--include-theme', '--sourcemap', '--strict-theme=<family,...>', '--no-strict-theme']) {
    assert.ok(build.stdout.includes(flag), `build --help must document ${flag}`);
  }
  assert.doesNotMatch(build.stdout, /--diff|--contrast|--multi|--src/);

  const theme = runCli(dir, 'theme', '--help');
  assert.match(theme.stdout, /^Usage: uxdsl theme /);
  for (const flag of ['--config', '--diff', '--contrast', '--strict-theme=<family,...>']) assert.ok(theme.stdout.includes(flag), `theme --help must document ${flag}`);
  assert.doesNotMatch(theme.stdout, /--entry|--out|--watch|--sourcemap/);

  assert.match(runCli(dir, 'init', '--help').stdout, /^Usage: uxdsl init \[--multi\]/);
  assert.match(runCli(dir, 'generate-entry', '--help').stdout, /^Usage: uxdsl generate-entry /);
  assert.equal(fs.existsSync(path.join(dir, 'out')), false, 'help never builds');
});

test('phase 2 (3): an unknown command is one line with a hint, not the whole help', () => {
  const dir = cliProject();
  const typo = runCli(dir, 'biuld');
  assert.equal(typo.status, 1);
  assert.equal(typo.stdout, '');
  assert.equal(typo.stderr.trim(), '[uxdsl] Unknown command "biuld": did you mean "uxdsl build"?');
  const far = runCli(dir, 'frobnicate');
  assert.equal(far.status, 1);
  assert.equal(far.stderr.trim(), '[uxdsl] Unknown command "frobnicate": run "uxdsl --help" for the list of commands');
});

test('phase 2 (3): `uxdsl watch` is gone — the hint is `uxdsl build --watch`, and a flag alone is not a build', () => {
  const dir = cliProject();
  const watch = runCli(dir, 'watch');
  assert.equal(watch.status, 1);
  assert.equal(watch.stderr.trim(), '[uxdsl] Unknown command "watch": use "uxdsl build --watch"');
  assert.equal(fs.existsSync(path.join(dir, 'out')), false);
  const flagOnly = runCli(dir, '--entry', 'src/a.uxdsl', '--out', 'out/a.css');
  assert.equal(flagOnly.status, 1);
  assert.match(flagOnly.stderr, /No command given/);
  assert.equal(fs.existsSync(path.join(dir, 'out')), false, 'the old silent default-to-build is gone');
});

test('phase 2 (3): `theme` no longer takes --entry/--out', () => {
  const dir = cliProject();
  const result = runCli(dir, 'theme', '--entry', 'src/a.uxdsl', '--out', 'x.css');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown option --entry\./);
  assert.match(result.stderr, /Unknown option --out\./);
});

test('phase 2 (3, CLI-1): `theme` runs from a theme file alone — no build config, no entry', () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.json', JSON.stringify({ $schema: './x.json', palette: { primary: { main: '#654321' } } }));
  const result = runCli(dir, 'theme');
  assert.equal(result.status, 0, result.stderr);
  const theme = JSON.parse(result.stdout);
  assert.equal(theme.palette.primary.main, '#654321');
  assert.equal(theme.palette.primary.contrast, DEFAULT_THEME.palette.primary.contrast, 'merged over the base');
  assert.equal(fs.readdirSync(dir).includes('src'), false, 'nothing was scaffolded or written');
});

test('phase 2 (3, CLI-2): `theme` prints the unknown-family warning build prints, on stderr, leaving stdout one JSON document', () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.json', JSON.stringify({ phase2ThemeCmdUnknownFamily: { x: 1 } }));
  const result = runCli(dir, 'theme');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /\[uxdsl\] Warning: .*Unknown theme family "phase2ThemeCmdUnknownFamily"/);
  assert.doesNotThrow(() => JSON.parse(result.stdout));
});

test('phase 2 (3): `theme --diff` never lists $schema as a project leaf, and --strict-theme never counts it', () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.json', JSON.stringify({ $schema: './node_modules/postcss-uxdsl/schema/theme.schema.json', breakpoints: { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 } }));
  const diff = runCli(dir, 'theme', '--diff');
  assert.equal(diff.status, 0, diff.stderr);
  const rows = JSON.parse(diff.stdout);
  assert.equal(rows.some((r) => r.path.startsWith('$schema')), false, JSON.stringify(rows.filter((r) => r.path.startsWith('$'))));
  assert.ok(rows.some((r) => r.path === 'breakpoints.md' && r.source === 'project'), 'control: a real family still appears');
  const strict = runCli(dir, 'theme', '--strict-theme=breakpoints');
  assert.equal(strict.status, 0, strict.stderr);
});
