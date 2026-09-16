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

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-cli-test-'));
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
  write(projectDir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  const entryPath = write(projectDir, 'src/entry.uxdsl', '.x { color: red; }');
  write(projectDir, 'uxdsl.theme.config.cjs', `module.exports = { palette: { primary: { main: '#123' } } };`);
  // cwd is the parent of `project/` — only --config tells loadConfig where
  // the real project lives, mirroring "uxdsl --config project/uxdsl.config.cjs"
  // run from somewhere else entirely.
  const config = await cli.loadConfig({ config: path.join('project', 'uxdsl.config.cjs') }, dir);
  assert.equal(config.entry, entryPath);
  assert.equal(config.theme.palette.primary.main, '#123');
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
