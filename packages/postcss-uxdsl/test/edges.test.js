const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const exported = require('../dist/index');
const plugin = exported.default || exported;
const { generateEdgeCss, inspectEdgeTheme, RADIUS_KEYWORDS } = require('../dist/edges');
const { generateThemeCss } = require('../dist/ds-runtime/theme-generator');
const { validateAndNormalizeTheme } = require('../dist/ds-runtime/theme-validate');
const theme = { breakpoints: { xs: 0, md: 800 }, borders: { 1: 'xs(1px solid palette(primary.main)) md(2px dashed palette(primary.main))' }, radii: { 2: 'xs(8px) md(12px)' } };
const compile = (source, options = {}) => postcss([plugin(options)]).process(source, { from: undefined });
function edgeDeclarations(css) {
  const result = [];
  postcss.parse(css).walkDecls(/^--(?:border|radius)-/, d => result.push([d.parent.parent.type === 'atrule' ? d.parent.parent.params : 'base', d.prop, d.value]));
  return result;
}
test('PostCSS and runtime emit the same responsive edge variables', async () => {
  const result = await compile('.card { border: border(1); border-radius: radius(2); }', { theme });
  assert.deepEqual(edgeDeclarations(result.css), edgeDeclarations(generateThemeCss(theme)));
  assert.match(result.css, /border: var\(--border-1\)/);
  assert.match(result.css, /border-radius: var\(--radius-2\)/);
});
test('inspection preserves values below, at, above and after transitions', () => {
  for (const [width, expected] of [[799, '8px'], [800, '12px'], [801, '12px'], [1600, '12px']]) assert.equal(inspectEdgeTheme(theme, width)['--radius-2'], expected);
  assert.equal(inspectEdgeTheme(theme, 800)['--border-1'], '2px dashed var(--ds__palette__primary-main)');
});
test('legacy @theme uses the shared generator and JSON wins over legacy declarations', async () => {
  const legacy = '@theme { radius-2: xs(8px) md(12px); border-1: xs(1px solid palette(primary.main)) md(2px dashed palette(primary.main)); } .card { border: border(1); border-radius: radius(2); }';
  const output = await compile(legacy, { breakpoints: { xs: 0, sm: 480, md: 800, lg: 1024, xl: 1280 } });
  assert.deepEqual(edgeDeclarations(output.css), edgeDeclarations(generateEdgeCss(theme)));
  const override = await compile('@theme { radius-2: 99px; } .card { border-radius: radius(2); }', { theme });
  assert(!override.css.includes('99px'));
});
test('edge definitions do not leak across PostCSS invocations', async () => {
  await compile('@theme { radius-2: 99px; } .a { border-radius: radius(2); }');
  const result = await compile('.b { border-radius: radius(2); }');
  assert(!result.css.includes('99px'));
});
test('literal values, nested CSS, shape keywords and references are preserved', async () => {
  assert.match(generateEdgeCss({ radii: { 2: 'calc(space(2) + 1px)' }, borders: { 1: '1px solid rgba(0, 0, 0, .2)' } }), /calc\(var\(--space-2\) \+ 1px\)/);
  for (const [key, value] of Object.entries(RADIUS_KEYWORDS)) assert((await compile(`.x { border-radius: radius(${key}); }`)).css.includes(`border-radius: ${value}`));
});
test('invalid updates fail before CSS is emitted', async () => {
  for (const bad of [{ radii: [] }, { radii: { 2: '' } }, { radii: { 2: 'md(12px)' } }, { borders: { 1: 'tablet(1px solid red)' } }]) {
    assert.throws(() => generateEdgeCss(bad));
    assert.equal(validateAndNormalizeTheme(bad).ok, false);
  }
  await assert.rejects(compile('.bad { border-radius: radius(234); }'));
});
