const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const exported = require('../dist/index');
const plugin = exported.default || exported;
const { generateEdgeCss, inspectEdgeTheme, RADIUS_KEYWORDS } = require('../dist/edges');
const { generateThemeCss } = require('../dist/ds-runtime/theme-generator');
const { validateTheme } = require('../dist/ds-runtime/theme-validate');
// Full 1-16 spacing so the always-on density/edge defaults (not just what
// this file's own source uses) pass strict reference validation. See
// docs/features/FEAT-002-beta-migration-hardening.md.
const FULL_SPACING = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i + 1, `${(i + 1) * 4}px`]));
const BASE_PALETTE = { primary: { main: '#123', dark: '#111', contrast: '#fff' }, surface: { main: '#fff', dark: '#eee', contrast: '#000' }, neutral: { main: '#999', dark: '#333' }, error: { main: '#f00' } };
const theme = { breakpoints: { xs: 0, md: 800 }, spacing: FULL_SPACING, palette: BASE_PALETTE, borders: { 1: 'xs(1px solid palette(primary.main)) md(2px dashed palette(primary.main))' }, radii: { 2: 'xs(8px) md(12px)' } };
const compile = (source, options = {}) => postcss([plugin(options)]).process(source, { from: undefined });
function edgeDeclarations(css) {
  const result = [];
  postcss.parse(css).walkDecls(/^--(?:border|radius)-/, d => result.push([d.parent.parent.type === 'atrule' ? d.parent.parent.params : 'base', d.prop, d.value]));
  return result;
}
test('PostCSS and runtime emit the same responsive edge variables', async () => {
  const result = await compile('.card { border: border(1); border-radius: radius(2); }', { theme });
  assert.deepEqual(edgeDeclarations(result.css), edgeDeclarations(generateThemeCss(theme)));
  assert.match(result.css, /border: var\(--uxdsl__border__1\)/);
  assert.match(result.css, /border-radius: var\(--uxdsl__radius__2\)/);
});
test('inspection preserves values below, at, above and after transitions', () => {
  for (const [width, expected] of [[799, '8px'], [800, '12px'], [801, '12px'], [1600, '12px']]) assert.equal(inspectEdgeTheme(theme, width)['--uxdsl__radius__2'], expected);
  assert.equal(inspectEdgeTheme(theme, 800)['--uxdsl__border__1'], '2px dashed var(--uxdsl__palette__primary-main)');
});
test('a @theme pack is not a second source of edges: it fails, and the JSON is what compiles', async () => {
  await assert.rejects(() => compile('@theme { radius-2: 99px; } .card { border-radius: radius(2); }', { theme }), /UXD_THEME_BLOCK_REMOVED/);
  const output = await compile('.card { border: border(1); border-radius: radius(2); }', { theme });
  assert.deepEqual(edgeDeclarations(output.css), edgeDeclarations(generateEdgeCss(theme)));
});
test('edge definitions do not leak across PostCSS invocations', async () => {
  const baseline = { spacing: FULL_SPACING, palette: BASE_PALETTE };
  const first = await compile('.a { border-radius: radius(2); }', { theme: { ...baseline, radii: { 2: '99px' } } });
  assert(first.css.includes('--uxdsl__radius__2: 99px'));
  const result = await compile('.b { border-radius: radius(2); }', { theme: baseline });
  assert(!result.css.includes('99px'));
});
test('literal values, nested CSS, shape keywords and references are preserved', async () => {
  assert.match(generateEdgeCss({ radii: { 2: 'calc(space(2) + 1px)' }, borders: { 1: '1px solid rgba(0, 0, 0, .2)' } }), /calc\(var\(--uxdsl__space__2\) \+ 1px\)/);
  for (const [key, value] of Object.entries(RADIUS_KEYWORDS)) assert((await compile(`.x { border-radius: radius(${key}); }`, { theme: { spacing: FULL_SPACING, palette: BASE_PALETTE } })).css.includes(`border-radius: ${value}`));
});
test('invalid updates fail before CSS is emitted', async () => {
  for (const bad of [{ radii: [] }, { radii: { 2: '' } }, { radii: { 2: 'md(12px)' } }, { borders: { 1: 'tablet(1px solid red)' } }]) {
    assert.throws(() => generateEdgeCss(bad));
    assert.equal(validateTheme(bad).ok, false);
  }
  await assert.rejects(compile('.bad { border-radius: radius(234); }'));
});
