'use strict';

// Stability phase 1 (audit 2026-09-29, finding T1 — P0): for the same theme,
// the PostCSS plugin and `generateThemeCss` (runtime, SSR, `applyTheme`) must
// emit the same theme CSS. They did not: the plugin's final pass rewrote token
// functions inside the generated `:root` blocks too, so `radii.x: 'radius(2)'`
// compiled to `var(--uxdsl__radius__2)` in a build and stayed the literal
// `radius(2)` at run time, with `applyTheme` reporting `ok: true`
// (docs/audits/2026-09-29-probes/lang/parity.js). One value grammar, resolved by
// the engines both paths share (`tokenValueToCss`, language.ts), closes it.
//
// What "the same" means here, by block: every top-level node of the plugin's
// theme output (author rules removed) is byte-identical to a node of
// `generateThemeCss`'s output, and vice versa. Phase 1's deliverable 4 (one
// insertion point for the whole theme) tightens `sameTheme` below to the
// concatenated string; until then the two paths still order the blocks
// differently, which is a placement question, not a value one.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');

const exported = require('../dist/index');
const plugin = exported.default || exported;
const { generateThemeCss, deepMergeTheme, resolveTheme } = require('../dist/ds-runtime');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(repoRoot, rel), 'utf8'));
const baseTheme = readJson('packages/postcss-uxdsl/src/theme/base.json');

// The same merge packages/playground-nextjs/themes.js performs
// (`deepMergeTheme(baseTheme, override)`); that file resolves the package
// through the playground's own node_modules, which this suite must not need.
const PLAYGROUND_THEMES = Object.fromEntries(['default', 'green', 'purple', 'slate'].map((name) =>
  [`playground ${name}`, deepMergeTheme(baseTheme, readJson(`packages/playground-nextjs/uxdsl.theme.${name}.json`))]));

// Every token function, in every family that takes a value: token references
// nested in responsive groups, alpha on palette()/color(), the radius
// keywords, both aliases, and var() as the escape hatch.
const SYNTHETIC = {
  breakpoints: { xs: 0, md: 700, xl: 1300 },
  colors: { white: '#ffffff', ink: 'color(gray.600)', brand: { 500: 'palette(primary.main)', 700: 'var(--uxdsl__color__gray-500)' } },
  spacing: { gutter: 'calc(space(2) * 2)', 17: 'space(16)' },
  palette: {
    brand: { main: 'color(gray.300)', dark: 'palette(primary.dark)', light: 'palette(primary, 0.5)', contrast: 'var(--uxdsl__color__white)' },
    ink: { main: 'color(ink)', subtle: 'color(brand.500, 0.125)' },
  },
  modes: { dark: { palette: { brand: { main: 'color(gray.600)', dark: 'palette(primary.light, 0.25)', contrast: 'color(white)' } } } },
  fonts: { families: { display: 'var(--uxdsl__font__ui)', 'display-2': 'Playfair Display, serif' } },
  typography_details: { hero: { fontFamily: 'var(--uxdsl__font__display)', fontSize: 'xs(density(4)) md(space(9))', letterSpacing: 'space(1)', marginBlockEnd: 'density(1)' } },
  typography: { 'font-hero': 'xs(var(--uxdsl__font__display)) md(var(--uxdsl__font__display-2))' },
  densities: { hero: 'xs(density(2)) md(space(6))' },
  radii: { hero: 'xs(radius(pill)) md(rounded(2)) xl(radius(circle))', tight: 'space(1)' },
  borders: { hero: 'xs(border(1)) md(space(1) solid palette(brand, 0.5))', dotted: 'space(1) dotted color(brand.500)' },
  shadows: { hero: 'xs(none) md(shadow(2))', tint: '0 0 0 space(1) palette(brand.light)' },
  surfaces: { hero: { padding: 'density(hero)', radius: 'radius(hero)', bg: 'palette(brand.main)', color: 'palette(brand.contrast)', border: 'border(hero)', shadow: 'elevation(hero)' } },
  buttons: { hero: { surface: 'hero', base: { 'font-weight': '600', shadow: 'shadow(tint)' }, states: { hover: { bg: 'palette(brand.dark)', border: 'border(dotted)' }, focusvisible: { outline: 'space(1) solid palette(brand.main, 0.5)', 'outline-offset': 'space(1)' } } } },
  inputs: { hero: { surface: 'hero', base: { caret: 'palette(brand.dark)', placeholder: 'color(ink)', radius: 'rounded(tight)' }, states: { focus: { border: 'border(dotted)', shadow: 'shadow(tint)' }, invalid: { underline: 'space(1) solid palette(error)' } } } },
};

const THEMES = { 'packaged base ({} override)': {}, ...PLAYGROUND_THEMES, 'synthetic: every token function in every family': SYNTHETIC };

const AUTHOR = '.parity-author { padding: xs(density(2)) md(space(3)); color: palette(primary); }';
const compile = (theme, source = '') => postcss([plugin({ theme, discoverTheme: false, includeTheme: true })]).process(source, { from: undefined }).css;

/** The plugin's output with the author's own rule (and the @media blocks the
 * responsive value split it into) removed — what remains is the theme. */
function withoutAuthor(css) {
  const root = postcss.parse(css);
  const isAuthor = (node) => (node.type === 'rule' && node.selector === '.parity-author')
    || (node.type === 'atrule' && node.name === 'media' && (node.nodes || []).length > 0 && node.nodes.every((child) => child.type === 'rule' && child.selector === '.parity-author'));
  for (const node of [...root.nodes]) if (isAuthor(node)) node.remove();
  return root.toString();
}

const blocks = (css) => postcss.parse(css).nodes.map((node) => node.toString());

function sameTheme(label, pluginCss, generated) {
  const a = blocks(pluginCss);
  const b = blocks(generated);
  assert.equal(a.length, b.length, `${label}: the plugin emits ${a.length} top-level blocks, generateThemeCss ${b.length}`);
  const onlyPlugin = a.filter((block) => !b.includes(block));
  const onlyGenerated = b.filter((block) => !a.includes(block));
  assert.deepEqual(onlyPlugin, [], `${label}: blocks only the plugin emits (byte-exact comparison)`);
  assert.deepEqual(onlyGenerated, [], `${label}: blocks only generateThemeCss emits (byte-exact comparison)`);
  assert.deepEqual([...a].sort(), [...b].sort(), `${label}: the two paths differ`);
}

for (const [label, theme] of Object.entries(THEMES)) {
  test(`build/runtime parity: ${label} — the plugin's theme CSS equals generateThemeCss(resolveTheme(theme)), block by block`, () => {
    const generated = generateThemeCss(resolveTheme(theme));
    sameTheme(`${label} (theme-only entry)`, compile(theme), generated);
    sameTheme(`${label} (with an author rule removed)`, withoutAuthor(compile(theme, AUTHOR)), generated);
    // Nothing the theme defines stays a literal token function, on either path.
    for (const css of [compile(theme), generated]) {
      assert.doesNotMatch(css, /:\s*(?:space|density|color|palette|radius|rounded|border|shadow|elevation)\([^)]*\)\s*;/, `${label}: an unresolved token function reached the theme CSS`);
    }
  });
}

// The audit's own twelve cases (docs/audits/2026-09-29-probes/lang/parity.js),
// each checked on the one declaration it names so the assertion reads as the
// probe did.
const grep = (css, re) => css.split(/(?<=;)|(?<=\})/).filter((s) => re.test(s)).map((s) => s.trim());
for (const [label, theme, re, resolved] of [
  ['radii.x = radius(2)', { radii: { x: 'radius(2)' } }, /radius__x:/, 'var(--uxdsl__radius__2)'],
  ['shadows.x = xs(none) md(shadow(1))', { shadows: { x: 'xs(none) md(shadow(1))' } }, /shadow__x:/, 'var(--uxdsl__shadow__1)'],
  ['densities.x = density(2)', { densities: { x: 'density(2)' } }, /density__x:/, 'var(--uxdsl__density__2)'],
  ['borders.x = border(1)', { borders: { x: 'border(1)' } }, /border__x:/, 'var(--uxdsl__border__1)'],
  ['surfaces.contained.padding = space(3)', { surfaces: { contained: { padding: 'space(3)' } } }, /contained-padding:/, 'var(--uxdsl__space__3)'],
  ['typography_details.h1.fontSize = density(4)', { typography_details: { h1: { fontSize: 'density(4)' } } }, /h1-size:/, 'var(--uxdsl__density__4)'],
  ['typography_details.h1.letterSpacing = palette(primary)', { typography_details: { h1: { letterSpacing: 'palette(primary)' } } }, /h1-spacing:/, 'var(--uxdsl__palette__primary-main)'],
  ['spacing.gutter = space(2)', { spacing: { gutter: 'space(2)' } }, /space__gutter:/, 'var(--uxdsl__space__2)'],
  ['palette.brand.main = color(gray.300)', { palette: { brand: { main: 'color(gray.300)' } } }, /brand-main:/, 'var(--uxdsl__color__gray-300)'],
  ['palette.brand.main = palette(primary, 0.5)', { palette: { brand: { main: 'palette(primary, 0.5)' } } }, /brand-main:/, 'color-mix(in srgb, var(--uxdsl__palette__primary-main) 50%, transparent)'],
  ['colors.x.1 = palette(primary)', { colors: { x: { 1: 'palette(primary)' } } }, /color__x-1:/, 'var(--uxdsl__palette__primary-main)'],
  ['fonts.families.ui = var(--uxdsl__font__code)', { fonts: { families: { ui: 'var(--uxdsl__font__code)' } } }, /font__ui:/, 'var(--uxdsl__font__code)'],
]) {
  test(`build/runtime parity (audit probe): ${label}`, () => {
    const viaPlugin = grep(compile(theme), re);
    const viaGenerator = grep(generateThemeCss(theme), re);
    assert.ok(viaPlugin.length > 0, `${label}: nothing matched in the plugin output`);
    assert.deepEqual(viaPlugin, viaGenerator, `${label}: plugin and generateThemeCss disagree`);
    assert.ok(viaGenerator.some((line) => line.includes(resolved)), `${label}: expected ${resolved} in ${viaGenerator.join(' | ')}`);
  });
}

test('build/runtime parity: applyTheme applies the resolved value, not the literal function', () => {
  const runtime = require('../dist/ds-runtime');
  const byId = new Map();
  const previous = globalThis.document;
  globalThis.document = {
    createElement(tag) { const attributes = {}; return { tagName: tag.toUpperCase(), id: '', textContent: '', setAttribute(n, v) { attributes[n] = v; }, getAttribute(n) { return n in attributes ? attributes[n] : null; } }; },
    getElementById(id) { return byId.get(id) || null; },
    head: { appendChild(node) { if (node.id) byId.set(node.id, node); return node; } },
  };
  try {
    runtime.__resetThemeStateForTests();
    assert.equal(runtime.applyTheme({}, { replace: true }).ok, true);
    const result = runtime.applyTheme({ palette: { brand: { main: 'palette(primary.main)' } }, radii: { x: 'radius(2)' } });
    assert.equal(result.ok, true, result.ok ? '' : result.error.message);
    const css = byId.get('uxdsl-theme').textContent;
    assert.match(css, /--uxdsl__palette__brand-main: var\(--uxdsl__palette__primary-main\);/);
    assert.match(css, /--uxdsl__radius__x: var\(--uxdsl__radius__2\);/);
    assert.doesNotMatch(css, /radius\(2\)|palette\(primary/);
  } finally {
    globalThis.document = previous;
  }
});

test('build/runtime parity: the plugin never rewrites a generated node — the theme output is idempotent through the compiler', () => {
  const themeCss = compile(SYNTHETIC);
  const again = postcss([plugin({ theme: SYNTHETIC, discoverTheme: false, includeTheme: false })]).process(themeCss, { from: undefined }).css;
  assert.equal(again, themeCss);
});

test('build/runtime parity: fonts.families are quoted the same way on both paths — as written', () => {
  const theme = { fonts: { families: { ui: 'Inter Tight, sans-serif', quoted: '"Segoe UI", sans-serif' } } };
  for (const css of [compile(theme), generateThemeCss(theme)]) {
    assert.match(css, /--uxdsl__font__ui: Inter Tight, sans-serif;/);
    assert.match(css, /--uxdsl__font__quoted: "Segoe UI", sans-serif;/);
  }
});

test('build/runtime parity: a native color() is left alone by the grammar on both paths', () => {
  const theme = { palette: { brand: { main: 'color(display-p3 1 0 0)' } } };
  for (const css of [compile(theme), generateThemeCss(theme)]) assert.match(css, /--uxdsl__palette__brand-main: color\(display-p3 1 0 0\);/);
});

test('build/runtime parity: a bad alpha is UXD_TOKEN_ALPHA in every family, on both paths', () => {
  for (const theme of [{ palette: { brand: { main: 'palette(primary, 2)' } } }, { radii: { x: 'palette(primary, 2)' } }, { surfaces: { contained: { bg: 'color(gray.300, -1)' } } }]) {
    assert.throws(() => generateThemeCss(theme), /UXD_TOKEN_ALPHA/);
    assert.throws(() => compile(theme), /UXD_TOKEN_ALPHA/);
  }
});
