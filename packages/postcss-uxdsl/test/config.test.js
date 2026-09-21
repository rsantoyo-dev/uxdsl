'use strict';

// MIG-B6-19 (FEAT-008): the one shared theme-config loader — candidates,
// module loading/normalization, the looks-like-a-build-config warning, and
// dependency tracking — used by both uxdsl-cli and the plugin's own
// discovery (see the "plugin with discovery" tests further down and
// index.ts's Once()). Moved out of uxdsl-cli so the two can never
// silently disagree about which file wins or what shape it accepts.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const postcss = require('postcss');
const config = require('../dist/config.js');
const exported = require('../dist/index.js');
const plugin = exported.default || exported;

function mkTmpDir() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'postcss-uxdsl-config-test-')));
}

function write(dir, relPath, content) {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

// --- Candidates / precedence ---

test('MIG-B6-19: THEME_CANDIDATES lists every conventional theme filename, most-specific first', () => {
  assert.deepEqual(config.THEME_CANDIDATES, [
    'uxdsl.theme.config.cjs',
    'uxdsl.theme.config.js',
    'uxdsl.theme.config.json',
    'uxdsl.theme.json',
  ]);
});

test('MIG-B6-19: findThemeConfigPath picks the first existing candidate in declared order', () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.config.json', '{}');
  write(dir, 'uxdsl.theme.json', '{}');
  const found = config.findThemeConfigPath(dir);
  assert.equal(path.basename(found), 'uxdsl.theme.config.json');
});

test('MIG-B6-19: findThemeConfigPath returns null when no candidate exists', () => {
  const dir = mkTmpDir();
  assert.equal(config.findThemeConfigPath(dir), null);
});

// --- normalizeThemeExport ---

test('MIG-B6-19: normalizeThemeExport recognizes the { theme, references } shape', () => {
  const references = { mode: 'off' };
  const theme = { palette: {} };
  assert.deepEqual(config.normalizeThemeExport({ theme, references }), { theme, references });
});

test('MIG-B6-19: normalizeThemeExport treats a bare theme object (no "theme"/"references" key) as theme data itself', () => {
  const bare = { palette: { primary: { main: '#000' } } };
  assert.deepEqual(config.normalizeThemeExport(bare), { theme: bare, references: undefined });
});

// --- Async loader (CLI/adapter contract): export shapes ---

test('MIG-B6-19: loadThemeConfigAsync accepts a plain object export', async () => {
  const dir = mkTmpDir();
  const file = write(dir, 'uxdsl.theme.config.cjs', "module.exports = { theme: { palette: { primary: { main: '#abc' } } } };");
  const { theme } = await config.loadThemeConfigAsync(file);
  assert.equal(theme.palette.primary.main, '#abc');
});

test('MIG-B6-19: loadThemeConfigAsync accepts a bare theme object with no theme/references key', async () => {
  const dir = mkTmpDir();
  const file = write(dir, 'uxdsl.theme.config.cjs', "module.exports = { palette: { primary: { main: '#abc' } } };");
  const { theme, references } = await config.loadThemeConfigAsync(file);
  assert.equal(theme.palette.primary.main, '#abc');
  assert.equal(references, undefined);
});

test('MIG-B6-19: loadThemeConfigAsync awaits an async factory export', async () => {
  const dir = mkTmpDir();
  const file = write(dir, 'uxdsl.theme.config.cjs', "module.exports = async () => ({ theme: { palette: { primary: { main: '#def' } } } });");
  const { theme } = await config.loadThemeConfigAsync(file);
  assert.equal(theme.palette.primary.main, '#def');
});

// --- Sync loader (plugin contract): rejects what it can't await ---

test('MIG-B6-19: loadThemeConfigSync accepts a plain object export, same as the async loader', () => {
  const dir = mkTmpDir();
  const file = write(dir, 'uxdsl.theme.config.cjs', "module.exports = { theme: { palette: { primary: { main: '#abc' } } } };");
  const { theme } = config.loadThemeConfigSync(file);
  assert.equal(theme.palette.primary.main, '#abc');
});

test('MIG-B6-19: loadThemeConfigSync throws a clear, actionable error for an async factory export', () => {
  const dir = mkTmpDir();
  const file = write(dir, 'uxdsl.theme.config.cjs', "module.exports = async () => ({ theme: {} });");
  assert.throws(() => config.loadThemeConfigSync(file), /exports an async function/);
});

// --- warnIfLooksLikeBuildConfig ---

test('MIG-B6-19: warnIfLooksLikeBuildConfig warns once for a build-config-shaped theme file', () => {
  const originalWarn = console.warn;
  const calls = [];
  console.warn = (...args) => calls.push(args.join(' '));
  try {
    config.warnIfLooksLikeBuildConfig({ entry: './x.uxdsl', outFile: './x.css' }, '/project/uxdsl.theme.config.cjs');
    config.warnIfLooksLikeBuildConfig({ entry: './x.uxdsl', outFile: './x.css' }, '/project/uxdsl.theme.config.cjs');
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(calls.length, 1, 'identical shape warns only once');
  assert.match(calls[0], /looks like a build config/);
});

test('MIG-B6-19: warnIfLooksLikeBuildConfig does not warn on the unambiguous { theme, references } shape', () => {
  const originalWarn = console.warn;
  const calls = [];
  console.warn = (...args) => calls.push(args.join(' '));
  try {
    config.warnIfLooksLikeBuildConfig({ theme: { watch: 'not-a-family' }, references: undefined }, '/project/uxdsl.theme.config.cjs');
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(calls.length, 0);
});

// --- Dependency tracking ---

test('MIG-B6-19: discoverThemeAsync/discoverThemeSync report the theme file and its nested local require()s as dependencies', async () => {
  const dir = mkTmpDir();
  write(dir, 'nested-theme-data.json', '{"palette":{"primary":{"main":"#123"}}}');
  write(dir, 'uxdsl.theme.config.cjs', "module.exports = { theme: require('./nested-theme-data.json') };");

  const asyncResult = await config.discoverThemeAsync(dir);
  assert.ok(asyncResult);
  assert.equal(path.basename(asyncResult.themeConfigPath), 'uxdsl.theme.config.cjs');
  assert.ok(asyncResult.dependencies.some((d) => d.endsWith('uxdsl.theme.config.cjs')));
  assert.ok(asyncResult.dependencies.some((d) => d.endsWith('nested-theme-data.json')));
  assert.equal(asyncResult.theme.palette.primary.main, '#123');

  const syncResult = config.discoverThemeSync(dir);
  assert.deepEqual(syncResult.theme, asyncResult.theme);
});

test('MIG-B6-19: discoverThemeSync/discoverThemeAsync return null when no theme file exists', async () => {
  const dir = mkTmpDir();
  assert.equal(config.discoverThemeSync(dir), null);
  assert.equal(await config.discoverThemeAsync(dir), null);
});

// --- Plugin with discovery: the actual PostCSS-facing contract ---

test('MIG-B6-19: the plugin discovers uxdsl.theme.config.* from configRoot when theme is omitted', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { theme: { palette: {
    'reviewonlybrand': { main: '#0af', dark: '#048', contrast: '#fff' },
  } } };`);
  const result = await postcss([plugin({ includeTheme: false, configRoot: dir })]).process(
    '.a { color: palette(reviewonlybrand); }',
    { from: undefined }
  );
  assert.match(result.css, /var\(--uxdsl__palette__reviewonlybrand-main\)/);
});

test('MIG-B6-19: discoverTheme: false keeps validating against the built-in default theme, same as before this story', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { theme: { palette: {
    'reviewonlybrand': { main: '#0af', dark: '#048', contrast: '#fff' },
  } } };`);
  await assert.rejects(
    postcss([plugin({ includeTheme: false, configRoot: dir, discoverTheme: false })]).process(
      '.a { color: palette(reviewonlybrand); }',
      { from: undefined }
    ),
    /UXD_REFERENCE_MISSING/
  );
});

test('MIG-B6-19: an explicit theme option always wins over discovery, even an empty one', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { theme: { palette: {
    'reviewonlybrand': { main: '#0af', dark: '#048', contrast: '#fff' },
  } } };`);
  await assert.rejects(
    postcss([plugin({ includeTheme: false, configRoot: dir, theme: {} })]).process(
      '.a { color: palette(reviewonlybrand); }',
      { from: undefined }
    ),
    /UXD_REFERENCE_MISSING/
  );
});

test('MIG-B6-19: two different configRoots processed in the same process do not share discovered overrides', async () => {
  const dirA = mkTmpDir();
  const dirB = mkTmpDir();
  write(dirA, 'uxdsl.theme.config.cjs', `module.exports = { theme: { palette: {
    'reviewonlybrand': { main: '#0af', dark: '#048', contrast: '#fff' },
  } } };`);
  write(dirB, 'uxdsl.theme.config.cjs', `module.exports = { theme: {} };`);

  const resultA = await postcss([plugin({ includeTheme: false, configRoot: dirA })]).process(
    '.a { color: palette(reviewonlybrand); }',
    { from: undefined }
  );
  assert.match(resultA.css, /var\(--uxdsl__palette__reviewonlybrand-main\)/);

  await assert.rejects(
    postcss([plugin({ includeTheme: false, configRoot: dirB })]).process(
      '.a { color: palette(reviewonlybrand); }',
      { from: undefined }
    ),
    /UXD_REFERENCE_MISSING/
  );
});

test('MIG-B6-19: the same plugin instance re-discovers a theme edited on disk between two compilations (not frozen at plugin construction)', async () => {
  const dir = mkTmpDir();
  const themeFile = write(dir, 'uxdsl.theme.config.cjs', `module.exports = { theme: { palette: {
    'reviewonlybrand': { main: '#0af', dark: '#048', contrast: '#fff' },
  } } };`);
  const instance = plugin({ includeTheme: false, configRoot: dir });

  const first = await postcss([instance]).process('.a { color: palette(reviewonlybrand); }', { from: undefined });
  assert.match(first.css, /var\(--uxdsl__palette__reviewonlybrand-main\)/);

  fs.writeFileSync(themeFile, `module.exports = { theme: {} };`);
  await assert.rejects(
    postcss([instance]).process('.a { color: palette(reviewonlybrand); }', { from: undefined }),
    /UXD_REFERENCE_MISSING/
  );
});

test('MIG-B6-19: discovery registers the theme file as a PostCSS dependency message', async () => {
  const dir = mkTmpDir();
  const themeFile = write(dir, 'uxdsl.theme.config.cjs', 'module.exports = { theme: {} };');
  const result = await postcss([plugin({ includeTheme: false, configRoot: dir })]).process('.a { color: red; }', { from: undefined });
  const dependencyFiles = result.messages.filter((m) => m.type === 'dependency').map((m) => m.file);
  assert.ok(dependencyFiles.includes(themeFile));
});
