const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const exported = require('../dist/plugin');
const plugin = exported.default || exported;
const { resolveTheme, deepMergeTheme, generateThemeCss } = require('./helpers/ds-runtime');
const { generateFoundationCss } = require('../dist/foundations');
const { resolveExpression } = require('../dist/ds-runtime/contrast');
const base = require('../src/theme/base.json');
const pinned = require('./fixtures/base-palette-resolved.json');

// Stability phase 5 (audit DE-11 / T12): the base theme demonstrates the model
// its own guide teaches — Palette roles reference Colors — instead of holding
// 49 literals in `palette` next to a four-shade `colors.gray`. Values only:
// the fixture pins every resolved palette variable, light and dark, exactly as
// it resolved before this change (the deliverable 2 values), so the proof that
// no color moved is a test, not a claim.

const paletteLeaves = (palette, prefix) => Object.entries(palette).flatMap(([family, variants]) =>
  Object.entries(variants).map(([variant, value]) => [`${prefix}${family}.${variant}`, value]));
const leaves = [...paletteLeaves(base.palette, 'palette.'), ...paletteLeaves(base.modes.dark.palette, 'modes.dark.palette.')];

function flatVars(css) {
  const out = {};
  postcss.parse(css).walkDecls(/^--/, (d) => { out[d.prop] = d.value; });
  return out;
}
const hex = (c) => '#' + [c.r, c.g, c.b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('') + (c.a < 1 ? `@${c.a}` : '');
function resolvedPalette(theme) {
  const light = flatVars(generateFoundationCss({ ...theme, modes: undefined }));
  const dark = flatVars(generateFoundationCss({ ...theme, palette: deepMergeTheme(theme.palette, theme.modes.dark.palette), modes: undefined }));
  const resolve = (map) => Object.fromEntries(Object.keys(map).filter((n) => n.startsWith('--uxdsl__palette__')).sort().map((name) => {
    const r = resolveExpression(map[name], map);
    return [name, r.ok ? hex(r.color) : `UNRESOLVED: ${r.reason}`];
  }));
  return { light: resolve(light), dark: resolve(dark) };
}

test('every base palette leaf, light and dark, references a Color or another Palette role — no literal remains', () => {
  for (const [path, value] of leaves) {
    assert.match(value, /^(color|palette)\([a-z0-9.-]+\)$/, `${path} = ${value}`);
  }
  assert.ok(leaves.filter(([, value]) => value.startsWith('color(')).length > 60, 'most leaves point at the collection');
});

test('`colors` holds `white`, `black` and every shade the palette and the borders use, and nothing else', () => {
  assert.equal(base.colors.white, '#ffffff');
  assert.equal(base.colors.black, '#000000');
  const defined = new Set();
  for (const [family, value] of Object.entries(base.colors)) {
    if (typeof value === 'string') defined.add(family);
    else for (const shade of Object.keys(value)) defined.add(`${family}.${shade}`);
  }
  const referenced = new Set();
  for (const [, value] of leaves) {
    const match = value.match(/^color\(([a-z0-9.-]+)\)$/);
    if (match) referenced.add(match[1]);
  }
  for (const value of Object.values(base.borders)) {
    for (const match of value.matchAll(/color\(([a-z0-9.-]+)\)/g)) referenced.add(match[1]);
  }
  for (const name of referenced) assert.ok(defined.has(name), `${name} is referenced but not defined`);
  for (const name of defined) assert.ok(referenced.has(name), `colors.${name} is defined but nothing references it`);
  // Every literal in the collection is a lowercase 6-digit hex, once: the
  // collection is a set of colors, not a list of aliases.
  const literals = Object.values(base.colors).flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v)));
  assert.ok(literals.every((v) => /^#[0-9a-f]{6}$/.test(v)), 'lowercase 6-digit hex only');
  assert.equal(new Set(literals).size, literals.length, 'no duplicate literal');
});

test('the resolved palette is byte-identical to what the literals resolved to before this change (light and dark)', () => {
  const resolved = resolvedPalette(resolveTheme());
  assert.equal(Object.values(resolved.light).concat(Object.values(resolved.dark)).filter((v) => /UNRESOLVED/.test(v)).length, 0);
  assert.deepEqual(resolved, pinned);
});

test('negative control: a Color edit reaches every role that references it, and the fixture notices', () => {
  const resolved = resolvedPalette(resolveTheme({ colors: { purple: { 700: '#000001' } } }));
  assert.equal(resolved.light['--uxdsl__palette__primary-main'], '#000001');
  assert.notDeepEqual(resolved, pinned);
});

test('`color(white, 0.5)`, `color(black)` and a bare shade compile with no theme of the project\'s own', async () => {
  const result = await postcss([plugin({})]).process('.a { background: color(white, 0.5); color: color(black); border-color: color(gray.450); }', { from: undefined });
  assert.match(result.css, /\.a\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--uxdsl__color__white\) 50%, transparent\)/);
  assert.match(result.css, /color:\s*var\(--uxdsl__color__black\)/);
  assert.match(result.css, /border-color:\s*var\(--uxdsl__color__gray-450\)/);
  assert.match(result.css, /--uxdsl__color__white: #ffffff;/);
  assert.match(result.css, /--uxdsl__color__black: #000000;/);
});

test('build and runtime emit the same reference for a palette role, and the contrast gate still passes', async () => {
  const theme = resolveTheme();
  const runtime = generateThemeCss(theme);
  const built = (await postcss([plugin({})]).process('.a { color: palette(primary.main); }', { from: undefined })).css;
  for (const line of ['--uxdsl__palette__primary-main: var(--uxdsl__color__purple-700);', '--uxdsl__palette__warning-contrast: var(--uxdsl__color__white);']) {
    assert.ok(runtime.includes(line), `runtime: ${line}`);
    assert.ok(built.includes(line), `build: ${line}`);
  }
  const { checkThemeContrast } = require('./helpers/ds-runtime');
  const report = checkThemeContrast(theme, { exceptions: require('../src/theme/base.contrast-exceptions.json') });
  assert.equal(report.passed, true);
  assert.deepEqual(report.failures, []);
});
