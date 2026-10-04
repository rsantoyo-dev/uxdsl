'use strict';

// The one shared theme-file loader — candidates, module loading, the
// looks-like-a-build-config warning, and dependency tracking — used by both
// uxdsl-cli and the plugin's own discovery (see the "plugin with discovery"
// tests further down and index.ts's Once()). Stability phase 2 froze what a
// theme file is: one of three names, exporting the theme itself.

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

test('phase 2: THEME_CANDIDATES is exactly the three theme-file names, most-specific first', () => {
  assert.deepEqual(config.THEME_CANDIDATES, [
    'uxdsl.theme.config.cjs',
    'uxdsl.theme.config.js',
    'uxdsl.theme.json',
  ]);
});

test('phase 2: findThemeConfigPath picks the first existing candidate in declared order', () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.config.js', 'module.exports = {};');
  write(dir, 'uxdsl.theme.json', '{}');
  const found = config.findThemeConfigPath(dir);
  assert.equal(path.basename(found), 'uxdsl.theme.config.js');
});

test('phase 2: a uxdsl.theme.config.json is not a theme file any more (uxdsl.theme.json is the JSON form)', () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.config.json', '{"palette":{"primary":{"main":"#000"}}}');
  assert.equal(config.findThemeConfigPath(dir), null);
});

test('MIG-B6-19: findThemeConfigPath returns null when no candidate exists', () => {
  const dir = mkTmpDir();
  assert.equal(config.findThemeConfigPath(dir), null);
});

// --- The export shape: the theme itself, nothing else ---

test('phase 2: a theme file exporting { theme, references } is refused, naming where each half goes', async () => {
  const dir = mkTmpDir();
  const file = write(dir, 'uxdsl.theme.config.cjs', "module.exports = { theme: { palette: {} }, references: { mode: 'off' } };");
  const expected = /exports \{ theme, references \}\. That wrapper was removed: a theme file exports the theme itself.*`references` belongs in uxdsl\.config\.cjs/;
  await assert.rejects(() => config.loadThemeConfigAsync(file), expected);
  assert.throws(() => config.loadThemeConfigSync(file), expected);
  assert.throws(() => config.discoverThemeSync(dir), expected, 'discovery goes through the same loader');
});

test('phase 2: the wrapper is refused even with only one of its two keys', async () => {
  const dir = mkTmpDir();
  const onlyTheme = write(dir, 'uxdsl.theme.config.cjs', 'module.exports = { theme: { palette: {} } };');
  await assert.rejects(() => config.loadThemeConfigAsync(onlyTheme), /exports \{ theme \}/);
  const onlyRefs = write(mkTmpDir(), 'uxdsl.theme.config.cjs', "module.exports = { references: { externalTokens: ['--x'] } };");
  await assert.rejects(() => config.loadThemeConfigAsync(onlyRefs), /exports \{ references \}/);
});

test('phase 2: normalizeThemeExport is gone — there is no second shape to normalize', () => {
  assert.equal(config.normalizeThemeExport, undefined);
});

// --- Async loader (CLI/adapter contract): export shapes ---

test('MIG-B6-19: loadThemeConfigAsync accepts a plain theme object export', async () => {
  const dir = mkTmpDir();
  const file = write(dir, 'uxdsl.theme.config.cjs', "module.exports = { palette: { primary: { main: '#abc' } } };");
  const { theme } = await config.loadThemeConfigAsync(file);
  assert.equal(theme.palette.primary.main, '#abc');
  assert.equal('references' in theme, false);
});

test('MIG-B6-19: loadThemeConfigAsync awaits an async factory export', async () => {
  const dir = mkTmpDir();
  const file = write(dir, 'uxdsl.theme.config.cjs', "module.exports = async () => ({ palette: { primary: { main: '#def' } } });");
  const { theme } = await config.loadThemeConfigAsync(file);
  assert.equal(theme.palette.primary.main, '#def');
});

test('phase 2: uxdsl.theme.json is read as the theme itself', async () => {
  const dir = mkTmpDir();
  const file = write(dir, 'uxdsl.theme.json', '{ "$schema": "./x.json", "palette": { "primary": { "main": "#123" } } }');
  const { theme } = await config.loadThemeConfigAsync(file);
  assert.equal(theme.palette.primary.main, '#123');
  assert.deepEqual(config.loadThemeConfigSync(file).theme, theme);
});

test('phase 2: a non-object export is an error naming the file', async () => {
  const dir = mkTmpDir();
  const file = write(dir, 'uxdsl.theme.config.cjs', 'module.exports = "not a theme";');
  await assert.rejects(() => config.loadThemeConfigAsync(file), /Invalid theme export in .*uxdsl\.theme\.config\.cjs: expected an object/);
});

// --- Sync loader (plugin contract): rejects what it can't await ---

test('MIG-B6-19: loadThemeConfigSync accepts a plain object export and a sync factory, same as the async loader', () => {
  const dir = mkTmpDir();
  const file = write(dir, 'uxdsl.theme.config.cjs', "module.exports = { palette: { primary: { main: '#abc' } } };");
  assert.equal(config.loadThemeConfigSync(file).theme.palette.primary.main, '#abc');
  const factory = write(mkTmpDir(), 'uxdsl.theme.config.cjs', "module.exports = () => ({ palette: { primary: { main: '#bcd' } } });");
  assert.equal(config.loadThemeConfigSync(factory).theme.palette.primary.main, '#bcd');
});

test('MIG-B6-19: loadThemeConfigSync throws a clear, actionable error for an async factory export', () => {
  const dir = mkTmpDir();
  const file = write(dir, 'uxdsl.theme.config.cjs', "module.exports = async () => ({});");
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
  assert.match(calls[0], /name it uxdsl\.config\.cjs instead/);
});

test('MIG-B6-19: warnIfLooksLikeBuildConfig stays silent for a theme made of real families', () => {
  const originalWarn = console.warn;
  const calls = [];
  console.warn = (...args) => calls.push(args.join(' '));
  try {
    config.warnIfLooksLikeBuildConfig({ palette: { primary: { main: '#000' } }, breakpoints: { md: 800 } }, '/project/uxdsl.theme.config.cjs');
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(calls.length, 0);
});

// --- Dependency tracking ---

test('MIG-B6-19: discoverThemeAsync/discoverThemeSync report the theme file and its nested local require()s as dependencies', async () => {
  const dir = mkTmpDir();
  write(dir, 'nested-theme-data.json', '{"palette":{"primary":{"main":"#123"}}}');
  write(dir, 'uxdsl.theme.config.cjs', "module.exports = require('./nested-theme-data.json');");

  const asyncResult = await config.discoverThemeAsync(dir);
  assert.ok(asyncResult);
  assert.equal(path.basename(asyncResult.themeConfigPath), 'uxdsl.theme.config.cjs');
  assert.ok(asyncResult.dependencies.some((d) => d.endsWith('uxdsl.theme.config.cjs')));
  assert.ok(asyncResult.dependencies.some((d) => d.endsWith('nested-theme-data.json')));
  assert.equal(asyncResult.theme.palette.primary.main, '#123');
  assert.equal(asyncResult.references, undefined, 'a discovered theme carries no references');

  const syncResult = config.discoverThemeSync(dir);
  assert.deepEqual(syncResult.theme, asyncResult.theme);
});

test('MIG-B6-19: discoverThemeSync/discoverThemeAsync return null when no theme file exists', async () => {
  const dir = mkTmpDir();
  assert.equal(config.discoverThemeSync(dir), null);
  assert.equal(await config.discoverThemeAsync(dir), null);
});

// --- Plugin with discovery: the actual PostCSS-facing contract ---

const BRAND_THEME = `module.exports = { palette: {
  'reviewonlybrand': { main: '#0af', dark: '#048', contrast: '#fff' },
} };`;

test('MIG-B6-19: the plugin discovers the theme file from configRoot when theme is omitted', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.config.cjs', BRAND_THEME);
  const result = await postcss([plugin({ includeTheme: false, configRoot: dir })]).process(
    '.a { color: palette(reviewonlybrand); }',
    { from: undefined }
  );
  assert.match(result.css, /var\(--uxdsl__palette__reviewonlybrand-main\)/);
});

test('phase 2: the plugin reads breakpoints from the discovered theme file', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.json', '{ "breakpoints": { "md": 900 } }');
  const result = await postcss([plugin({ includeTheme: false, configRoot: dir })]).process(
    '.a { padding: xs(1rem) md(2rem); }',
    { from: undefined }
  );
  assert.match(result.css, /@media \(min-width: 900px\)/);
  assert.doesNotMatch(result.css, /768px/);
});

test('MIG-B6-19: discoverTheme: false keeps validating against the built-in default theme, same as before this story', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.config.cjs', BRAND_THEME);
  await assert.rejects(
    postcss([plugin({ includeTheme: false, configRoot: dir, discoverTheme: false })]).process(
      '.a { color: palette(reviewonlybrand); }',
      { from: undefined }
    ),
    /UXD_PALETTE_REFERENCE/
  );
});

test('MIG-B6-19: an explicit theme option always wins over discovery, even an empty one', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.config.cjs', BRAND_THEME);
  await assert.rejects(
    postcss([plugin({ includeTheme: false, configRoot: dir, theme: {} })]).process(
      '.a { color: palette(reviewonlybrand); }',
      { from: undefined }
    ),
    /UXD_PALETTE_REFERENCE/
  );
});

test('MIG-B6-19: two different configRoots processed in the same process do not share discovered overrides', async () => {
  const dirA = mkTmpDir();
  const dirB = mkTmpDir();
  write(dirA, 'uxdsl.theme.config.cjs', BRAND_THEME);
  write(dirB, 'uxdsl.theme.config.cjs', 'module.exports = {};');

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
    /UXD_PALETTE_REFERENCE/
  );
});

test('MIG-B6-19: the same plugin instance re-discovers a theme edited on disk between two compilations (not frozen at plugin construction)', async () => {
  const dir = mkTmpDir();
  const themeFile = write(dir, 'uxdsl.theme.config.cjs', BRAND_THEME);
  const instance = plugin({ includeTheme: false, configRoot: dir });

  const first = await postcss([instance]).process('.a { color: palette(reviewonlybrand); }', { from: undefined });
  assert.match(first.css, /var\(--uxdsl__palette__reviewonlybrand-main\)/);

  fs.writeFileSync(themeFile, 'module.exports = {};');
  await assert.rejects(
    postcss([instance]).process('.a { color: palette(reviewonlybrand); }', { from: undefined }),
    /UXD_PALETTE_REFERENCE/
  );
});

test('MIG-B6-19: discovery registers the theme file as a PostCSS dependency message', async () => {
  const dir = mkTmpDir();
  const themeFile = write(dir, 'uxdsl.theme.config.cjs', 'module.exports = {};');
  const result = await postcss([plugin({ includeTheme: false, configRoot: dir })]).process('.a { color: red; }', { from: undefined });
  const dependencyFiles = result.messages.filter((m) => m.type === 'dependency').map((m) => m.file);
  assert.ok(dependencyFiles.includes(themeFile));
});
