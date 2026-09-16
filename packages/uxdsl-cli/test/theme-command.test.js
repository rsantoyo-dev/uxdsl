'use strict';

// MIG-B3-04 (FEAT-004): `uxdsl theme` introspection. Answers "what theme did
// my build actually resolve, and where did each value come from" using the
// exact same loadConfig()/resolveTheme() path `build` uses, instead of
// diffing compiled CSS by hand.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const cli = require('../bin/uxdsl.js');
const { DEFAULT_THEME } = require('postcss-uxdsl/ds-runtime');

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-theme-cmd-test-'));
}

function write(dir, relPath, content) {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

function captureStdout(fn) {
  const original = console.log;
  const lines = [];
  console.log = (...args) => { lines.push(args.join(' ')); };
  try {
    return { result: fn(), output: () => lines.join('\n') };
  } finally {
    console.log = original;
  }
}

async function captureStdoutAsync(fn) {
  const original = console.log;
  const lines = [];
  console.log = (...args) => { lines.push(args.join(' ')); };
  try {
    await fn();
    return lines.join('\n');
  } finally {
    console.log = original;
  }
}

test('MIG-B3-04: diffThemeAgainstDefaults only lists families the raw theme actually mentions', () => {
  const raw = { fonts: { families: { ui: 'Georgia' } } };
  const effective = { fonts: { families: { ui: 'Georgia', 'ui-2': DEFAULT_THEME.fonts.families['ui-2'], code: DEFAULT_THEME.fonts.families.code } }, spacing: DEFAULT_THEME.spacing };
  const rows = cli.diffThemeAgainstDefaults(raw, effective);
  const paths = rows.map((r) => r.path).sort();
  assert.deepEqual(paths, ['fonts.families.code', 'fonts.families.ui', 'fonts.families.ui-2']);
  assert.ok(!paths.some((p) => p.startsWith('spacing')), 'an untouched family must not appear at all');
});

test('MIG-B3-04: diffThemeAgainstDefaults labels the overridden leaf "project" and untouched siblings "default"', () => {
  const raw = { fonts: { families: { ui: 'Georgia' } } };
  const effective = { fonts: { families: { ui: 'Georgia', 'ui-2': DEFAULT_THEME.fonts.families['ui-2'], code: DEFAULT_THEME.fonts.families.code } } };
  const rows = cli.diffThemeAgainstDefaults(raw, effective);
  const byPath = Object.fromEntries(rows.map((r) => [r.path, r.source]));
  assert.equal(byPath['fonts.families.ui'], 'project');
  assert.equal(byPath['fonts.families.ui-2'], 'default');
  assert.equal(byPath['fonts.families.code'], 'default');
});

test('MIG-B3-04: a leaf explicitly set to the same value the default already uses still counts as "project" (presence, not value equality)', () => {
  const raw = { fonts: { families: { ui: DEFAULT_THEME.fonts.families.ui } } };
  const effective = { fonts: { families: { ui: DEFAULT_THEME.fonts.families.ui } } };
  const rows = cli.diffThemeAgainstDefaults(raw, effective);
  assert.deepEqual(rows, [{ path: 'fonts.families.ui', value: DEFAULT_THEME.fonts.families.ui, source: 'project' }]);
});

test('MIG-B3-04: a family with no built-in default at all (e.g. colors) is entirely "project"', () => {
  const raw = { colors: { brand: { main: '#123456' } } };
  const effective = { colors: { brand: { main: '#123456' } } };
  const rows = cli.diffThemeAgainstDefaults(raw, effective);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.source === 'project'));
});

test('MIG-B3-04: findPartiallyDefaultedFamilies flags a family declared partially, not one declared completely', () => {
  const raw = { palette: { primary: { main: '#123456' } } };
  const effective = {
    palette: {
      primary: { main: '#123456', dark: DEFAULT_THEME.palette.primary.dark, contrast: DEFAULT_THEME.palette.primary.contrast },
      surface: DEFAULT_THEME.palette.surface,
      neutral: DEFAULT_THEME.palette.neutral,
      error: DEFAULT_THEME.palette.error,
    },
  };
  assert.deepEqual(cli.findPartiallyDefaultedFamilies(raw, effective), ['palette']);

  const fullPalette = { palette: DEFAULT_THEME.palette };
  assert.deepEqual(cli.findPartiallyDefaultedFamilies(fullPalette, fullPalette), []);
});

test('MIG-B3-04: `uxdsl theme` with no project theme prints DEFAULT_THEME verbatim as valid JSON', async () => {
  const dir = mkTmpDir();
  const output = await captureStdoutAsync(() => cli.themeCommand({}, dir));
  const parsed = JSON.parse(output);
  assert.deepEqual(parsed, DEFAULT_THEME);
});

test('MIG-B3-04: `uxdsl theme` reflects a project theme file through the same discovery build uses', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { palette: { primary: { main: '#654321' } } };`);
  const output = await captureStdoutAsync(() => cli.themeCommand({}, dir));
  const parsed = JSON.parse(output);
  assert.equal(parsed.palette.primary.main, '#654321');
  assert.equal(parsed.palette.primary.contrast, DEFAULT_THEME.palette.primary.contrast, 'untouched sibling keeps its default');
});

test('MIG-B3-04: `uxdsl theme --diff` output is parseable JSON limited to the touched path', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { fonts: { families: { ui: 'var(--font-geist-sans)' } } };`);
  const output = await captureStdoutAsync(() => cli.themeCommand({ diff: true }, dir));
  const rows = JSON.parse(output);
  assert.ok(Array.isArray(rows));
  const projectRows = rows.filter((r) => r.source === 'project');
  assert.deepEqual(projectRows.map((r) => r.path), ['fonts.families.ui']);
  assert.equal(projectRows[0].value, 'var(--font-geist-sans)');
});

test('MIG-B3-04: `uxdsl theme --strict` fails with a non-zero-signaling throw when a declared family is partially defaulted', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { palette: { primary: { main: '#111111' } } };`);
  await assert.rejects(
    () => captureStdoutAsync(() => cli.themeCommand({ strict: true }, dir)),
    /--strict:.*palette/
  );
});

test('MIG-B3-04: `uxdsl theme --strict` passes when every key of a declared family is explicit', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { palette: ${JSON.stringify(DEFAULT_THEME.palette)} };`);
  // Must not throw.
  await captureStdoutAsync(() => cli.themeCommand({ strict: true }, dir));
});
