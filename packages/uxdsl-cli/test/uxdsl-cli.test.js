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
const postcss = require('postcss');

const cli = require('../bin/uxdsl.js');
const uxdslPluginModule = require('postcss-uxdsl');
const uxdslPlugin = uxdslPluginModule.default || uxdslPluginModule;

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
  write(projectDir, 'uxdsl.theme.config.cjs', `module.exports = { palette: { primary: { main: '#123' } } };`);
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
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { fonts: { families: { ui: 'Inter' } } };`);
  const config = await cli.loadConfig({}, dir);
  assert.deepEqual(config.theme, { fonts: { families: { ui: 'Inter' } } });
  assert.equal(config.references, undefined);
});

test('MIG-B2-01: a theme file exporting { theme, references } splits both fields correctly', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { theme: { fonts: { families: { ui: 'Inter' } } }, references: { externalTokens: ['--host-token'] } };`);
  const config = await cli.loadConfig({}, dir);
  assert.deepEqual(config.theme, { fonts: { families: { ui: 'Inter' } } });
  assert.deepEqual(config.references, { externalTokens: ['--host-token'] });
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

test('MIG-B2-01: externalTokens declared in the theme file lets a UXDSL-generated declaration reference a host variable with no fallback', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '/* no component rules needed — includeTheme defaults to true */');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { theme: ${JSON.stringify(HOST_FONT_THEME)}, references: { externalTokens: ['--host-token'] } };`);
  const config = await cli.loadConfig({}, dir);
  const source = fs.readFileSync(config.entry, 'utf8');
  const result = await postcss([uxdslPlugin({ theme: config.theme, references: config.references })]).process(source, { from: config.entry });
  assert.match(result.css, /--uxdsl__font__ui: var\(--host-token\)/);
});

test('MIG-B2-01: the same theme without externalTokens still fails with UXD_REFERENCE_MISSING', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '/* no component rules needed — includeTheme defaults to true */');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = ${JSON.stringify(HOST_FONT_THEME)};`);
  const config = await cli.loadConfig({}, dir);
  assert.equal(config.references, undefined);
  const source = fs.readFileSync(config.entry, 'utf8');
  await assert.rejects(
    () => postcss([uxdslPlugin({ theme: config.theme, references: config.references })]).process(source, { from: config.entry }).then((r) => r.css),
    /UXD_REFERENCE_MISSING/
  );
});

test('MIG-B2-01: references declared in uxdsl.config.cjs have complete precedence over the theme file\'s', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', references: { externalTokens: ['--from-build'] } };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { theme: {}, references: { externalTokens: ['--from-theme'] } };`);
  const config = await cli.loadConfig({}, dir);
  assert.deepEqual(config.references, { externalTokens: ['--from-build'] });
});

test('MIG-B2-01: a theme file\'s `references` key never leaks into the theme object sent to the compiler', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { theme: { fonts: { families: { ui: 'Inter' } } }, references: { externalTokens: ['--x'] } };`);
  const config = await cli.loadConfig({}, dir);
  assert.equal('references' in config.theme, false);
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
  const themePath = write(dir, 'uxdsl.theme.config.cjs', `module.exports = {};`);
  const config = await cli.loadConfig({}, dir);
  assert.ok(config.watch.includes(themePath), `expected ${themePath} in ${JSON.stringify(config.watch)}`);
});

test('MIG-B2-01 (implementation item 10): a theme file with no uxdsl.config.cjs falls back to the conventional entry/output when it exists', async () => {
  const dir = mkTmpDir();
  const entryPath = write(dir, cli.DEFAULT_ENTRY_REL, '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { fonts: { families: { ui: 'Inter' } } };`);
  const config = await cli.loadConfig({}, dir);
  assert.equal(config.entry, entryPath);
  assert.equal(config.outFile, path.resolve(dir, cli.DEFAULT_OUT_REL));
  assert.deepEqual(config.theme, { fonts: { families: { ui: 'Inter' } } });
});

test('MIG-B2-01 (implementation item 10): a theme file with no config and no conventional entry fails with an actionable error', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = {};`);
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

test('MIG-B2-01: an inline theme in uxdsl.config.cjs still works, and suppresses conventional theme-file discovery', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', theme: { fonts: { families: { ui: 'Georgia' } } } };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  // Present but must be ignored since the build config already declares theme inline.
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { fonts: { families: { ui: 'Inter' } } };`);
  const config = await cli.loadConfig({}, dir);
  assert.deepEqual(config.theme, { fonts: { families: { ui: 'Georgia' } } });
});

test('MIG-B2-01: `themeFile` in uxdsl.config.cjs wins over the conventional name and resolves relative to the build config', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', themeFile: './theme/custom.cjs' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { fonts: { families: { ui: 'Ignored' } } };`);
  write(dir, 'theme/custom.cjs', `module.exports = { fonts: { families: { ui: 'Custom' } } };`);
  const config = await cli.loadConfig({}, dir);
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

test('MIG-B3-01: resolveBreakpoints — config wins over theme, theme wins over defaults, both merge partially', () => {
  const defaults = cli.resolveBreakpoints(undefined, undefined);
  assert.deepEqual(defaults, { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 });

  const themeOnly = cli.resolveBreakpoints(undefined, { xl: 1440 });
  assert.deepEqual(themeOnly, { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1440 });

  const configWins = cli.resolveBreakpoints({ xl: 1600 }, { xl: 1440, sm: 500 });
  assert.deepEqual(configWins, { xs: 0, sm: 500, md: 768, lg: 1024, xl: 1600 });
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

test('MIG-B3-01: a theme-declared breakpoint reaches loadConfig\'s resolved breakpoints', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { breakpoints: { xl: 1440 } };`);
  const config = await cli.loadConfig({}, dir);
  assert.equal(config.breakpoints.xl, 1440);
  assert.equal(config.breakpoints.sm, 480, 'unrelated breakpoints keep their default');
});

test('MIG-B3-01: uxdsl.config.cjs breakpoints win over the theme file\'s on the same key', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', breakpoints: { xl: 1600 } };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { breakpoints: { xl: 1440 } };`);
  const config = await cli.loadConfig({}, dir);
  assert.equal(config.breakpoints.xl, 1600);
});

test('MIG-B3-01: buildOnce with includeTheme: false emits no :root and no #uxdsl-bp-meta marker', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css', includeTheme: false };`);
  write(dir, 'src/entry.uxdsl', `.card { @ds-surface(contained); }`);
  const config = await cli.loadConfig({}, dir);
  config.theme = FULL_THEME;
  await cli.buildOnce(config);
  const css = fs.readFileSync(config.outFile, 'utf8');
  assert.doesNotMatch(css, /:root/);
  assert.doesNotMatch(css, /#uxdsl-bp-meta/);
  assert.doesNotMatch(css, /@uxdsl-bp/);
});

test('MIG-B3-01: buildOnce with includeTheme: true (default) still emits :root and the #uxdsl-bp-meta marker', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', `.card { @ds-surface(contained); }`);
  const config = await cli.loadConfig({}, dir);
  config.theme = FULL_THEME;
  await cli.buildOnce(config);
  const css = fs.readFileSync(config.outFile, 'utf8');
  assert.match(css, /:root/);
  assert.match(css, /#uxdsl-bp-meta/);
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

  const combined = fs.readFileSync(themeConfig.outFile, 'utf8') + '\n' + fs.readFileSync(panelConfig.outFile, 'utf8');
  const rootCount = (combined.match(/:root/g) || []).length;
  const bpMetaCount = (combined.match(/#uxdsl-bp-meta/g) || []).length;
  assert.ok(rootCount > 0, 'the theme entry must still define :root');
  assert.equal(bpMetaCount, 1, `expected exactly one #uxdsl-bp-meta across both entries; got ${bpMetaCount}`);
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
// Without a "theme" or "references" key, a theme file's entire export
// becomes "the theme" (see normalizeThemeExport) — a uxdsl.config.cjs
// accidentally copied/renamed to a theme-file name silently "worked" with
// its entry/outFile/watch keys quietly ignored as unknown tokens.

test('MIG-B3-03: warnIfLooksLikeBuildConfig warns when a theme export has no theme/references key but has build-config keys', () => {
  const { messages } = captureWarnings(() =>
    cli.warnIfLooksLikeBuildConfig({ entry: './src/entry.uxdsl', outFile: './src/out.css' }, '/project/uxdsl.theme.config.cjs')
  );
  assert.equal(messages.length, 1);
  assert.match(messages[0], /uxdsl\.theme\.config\.cjs/);
  assert.match(messages[0], /"entry"/);
  assert.match(messages[0], /"outFile"/);
});

test('MIG-B3-03: warnIfLooksLikeBuildConfig stays silent for the { theme, references } shape even with build-config-named keys', () => {
  const { messages } = captureWarnings(() =>
    cli.warnIfLooksLikeBuildConfig({ theme: { watch: 'not-actually-a-family' }, references: undefined }, '/project/uxdsl.theme.config.cjs')
  );
  assert.deepEqual(messages, []);
});

test('MIG-B3-03: warnIfLooksLikeBuildConfig stays silent for a bare theme object with no build-config-shaped keys', () => {
  const { messages } = captureWarnings(() =>
    cli.warnIfLooksLikeBuildConfig({ fonts: { families: { ui: 'Inter' } } }, '/project/uxdsl.theme.config.cjs')
  );
  assert.deepEqual(messages, []);
});

test('MIG-B3-03: loadConfig surfaces the collision warning for a real theme file shaped like a build config', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  // A build-config file accidentally saved under the theme-file name.
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { entry: './other/entry.uxdsl', outFile: './other/out.css', watch: [] };`);
  const { messages } = await captureWarningsAsync(() => cli.loadConfig({}, dir));
  assert.ok(messages.some((m) => /looks like a build config/.test(m)), `expected a collision warning; got ${JSON.stringify(messages)}`);
});

test('MIG-B3-03: the same theme-file shape only warns once per session (no per-rebuild spam)', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { entry: './other/entry.uxdsl' };`);
  const { messages: first } = await captureWarningsAsync(() => cli.loadConfig({}, dir));
  assert.equal(first.length, 1);
  const { messages: second } = await captureWarningsAsync(() => cli.loadConfig({}, dir));
  assert.deepEqual(second, [], 'a second loadConfig call with the identical shape must not warn again');
});

// --- MIG-B3-02 (FEAT-004): multiple entries in one uxdsl.config.cjs ---
// A `builds` array compiles a theme entry and any number of component/
// CSS-Module entries against the same shared theme/references/breakpoints
// in a single `uxdsl build`/`watch` invocation.

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
  assert.match(themeCss, /#uxdsl-bp-meta/);
  assert.doesNotMatch(panelCss, /:root/);
  assert.doesNotMatch(panelCss, /#uxdsl-bp-meta/);
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

test('MIG-B4-02: a uxdsl.theme.config.cjs that requires a nested JSON file has that file in loadConfig\'s watch list', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'theme-data.json', JSON.stringify({ palette: { primary: { main: '#123456' } } }));
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = require('./theme-data.json');`);
  const config = await cli.loadConfig({}, dir);
  const themeDataPath = path.join(dir, 'theme-data.json');
  assert.ok(config.watch.includes(themeDataPath), `expected ${themeDataPath} in ${JSON.stringify(config.watch)}`);
});

test('MIG-B4-02: the theme/config file itself is still recorded using its own canonical path, not a resolved variant', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  const themePath = write(dir, 'uxdsl.theme.config.cjs', `module.exports = {};`);
  const config = await cli.loadConfig({}, dir);
  // Exact string match against what findThemeConfigPath/resolvePath produced
  // (config.themeConfigPath), not merely "some path resolving to the same
  // file" — a mismatch here (e.g. via require.resolve()'s realpath, which
  // differs from this on any /tmp-is-a-symlink system such as macOS) would
  // silently double-watch the same physical file under two spellings.
  assert.ok(config.watch.includes(config.themeConfigPath));
  assert.equal(config.watch.filter((w) => w === themePath).length, 1);
});
