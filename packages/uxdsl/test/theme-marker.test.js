'use strict';

// Stability phase 4 (decision DE-9): `@uxdsl theme;` emits the theme where it
// is written, and only there — so a PostCSS-only setup (Next.js with
// `'uxdsl/postcss': { includeTheme: false }` in postcss.config.js) needs no
// CLI: the one global stylesheet carries the marker, every CSS Module just
// uses tokens and stays free of `:root`.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const plugin = require('../dist/plugin');
const { compile } = require('../dist/entries/index');
const { generateThemeCss } = require('../dist/entries/theme');

const run = (css, options = {}) => postcss([plugin({ discoverTheme: false, ...options })]).process(css, { from: 'globals.css' }).css;
const rootBlocks = (css) => (css.match(/(^|[\s}]):root[\s{[:]/g) || []).length;
const failure = (fn) => { try { fn(); } catch (error) { return error; } throw new Error('expected a failure'); };

test('DE-9: with includeTheme: false, `@uxdsl theme;` emits the theme at the marker and nowhere else', () => {
  const css = run('.before { color: red; }\n@uxdsl theme;\n.after { color: palette(primary.main); }\n', { includeTheme: false });
  assert.doesNotMatch(css, /@uxdsl/, 'the marker itself is not in the output');
  assert.ok(rootBlocks(css) > 0, 'the theme was emitted');
  const before = css.indexOf('.before');
  const firstRoot = css.indexOf(':root');
  const after = css.indexOf('.after');
  assert.ok(before < firstRoot && firstRoot < after, 'the theme sits where the marker was');
  assert.match(css.slice(firstRoot, after), /--uxdsl__palette__primary-main:/);
});

test('DE-9: the emitted theme is the theme stylesheet generateThemeCss returns, byte for byte (its @imports lead the file)', () => {
  const theme = { fonts: { google: ['Inter:wght@400;700'] } };
  const css = run('.a { color: red; }\n@uxdsl theme;\n', { includeTheme: false, theme });
  const generated = generateThemeCss(theme);
  const imports = generated.split('\n').filter((line) => line.startsWith('@import'));
  const blocks = generated.split('\n').filter((line) => !line.startsWith('@import')).join('\n');
  assert.ok(imports.length > 0, 'control: the theme has a Google Fonts @import');
  assert.ok(css.startsWith(imports.join('\n')), 'the theme\'s @import leads the stylesheet, as CSS requires');
  assert.ok(css.includes(blocks), 'the blocks are the generated theme, unchanged');
});

test('DE-9: without the marker, includeTheme: false still emits no :root (a CSS Module)', () => {
  const css = run('.card { padding: density(2); color: palette(primary.main); }\n', { includeTheme: false });
  assert.equal(rootBlocks(css), 0);
  assert.match(css, /var\(--uxdsl__density__2\)/);
});

test('DE-9: with the default includeTheme, the marker decides where the one copy goes', () => {
  const css = run('.first { color: red; }\n@uxdsl theme;\n');
  const marked = css.indexOf(':root');
  assert.ok(css.indexOf('.first') < marked, 'not hoisted above the rules written before the marker');
  assert.equal(css.split('--uxdsl__palette__primary-main:').length - 1, run('.first { color: red; }\n').split('--uxdsl__palette__primary-main:').length - 1, 'emitted once, as without the marker');
});

test('DE-9: a misplaced, repeated or misspelled marker is UXD_THEME_MARKER, with its position', () => {
  const nested = failure(() => run('.a { @uxdsl theme; }\n', { includeTheme: false }));
  assert.match(nested.message, /UXD_THEME_MARKER: .*top level/);
  assert.equal(nested.line, 1);
  const media = failure(() => run('@media (min-width: 1px) { @uxdsl theme; }\n', { includeTheme: false }));
  assert.match(media.message, /UXD_THEME_MARKER/);
  const twice = failure(() => run('@uxdsl theme;\n.a { color: red; }\n@uxdsl theme;\n', { includeTheme: false }));
  assert.match(twice.message, /UXD_THEME_MARKER: .*twice/);
  assert.equal(twice.line, 3);
  const typo = failure(() => run('@uxdsl them;\n', { includeTheme: false }));
  assert.match(typo.message, /UXD_THEME_MARKER: @uxdsl them is not a UXDSL at-rule.*`@uxdsl theme;`/);
  const block = failure(() => run('@uxdsl theme { }\n', { includeTheme: false }));
  assert.match(block.message, /UXD_THEME_MARKER/);
});

test('DE-9: the marker works through compile() (the SCSS-subset pipeline the CLI and the adapters run)', async () => {
  const { css } = await compile({ source: '$gap: 1rem;\n@uxdsl theme;\n.a { gap: $gap; color: palette(primary.main); }\n', from: 'globals.uxdsl' }, { includeTheme: false, theme: {} });
  assert.ok(rootBlocks(css) > 0);
  assert.doesNotMatch(css, /@uxdsl/);
});

test('DE-9: the emitted theme is reference-checked like any other: a dangling theme value fails the marked stylesheet', () => {
  const theme = { palette: { primary: { main: 'color(nope.500)' } } };
  const error = failure(() => run('@uxdsl theme;\n.a { color: red; }\n', { includeTheme: false, theme }));
  assert.match(error.message, /UXD_REFERENCE_MISSING: .*--uxdsl__color__nope-500/);
});
