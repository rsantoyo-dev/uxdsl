const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const exported = require('../dist/index');
const plugin = exported.default || exported;
const { generateShadowCss, inspectShadowTheme } = require('../dist/shadows');
const { generateThemeCss } = require('../dist/ds-runtime/theme-generator');
const { validateAndNormalizeTheme } = require('../dist/ds-runtime/theme-validate');
const expression = 'xs(0 2px 4px rgba(0,0,0,.12), inset 0 1px 2px rgba(0,0,0,.2)) md(0 6px 16px rgba(0,0,0,.18))';
const theme = { breakpoints: { xs: 0, md: 800 }, shadows: { 2: expression, named: 'none' } };
const compile = (source, options = {}) => postcss([plugin(options)]).process(source, { from: undefined });
function shadows(css) {
  const result = [];
  postcss.parse(css).walkDecls(/^--shadow-/, d => result.push([d.parent.parent.type === 'atrule' ? d.parent.parent.params : 'base', d.prop, d.value]));
  return result;
}
test('Shadow JSON has equivalent build/runtime output; aliases preserve references', async () => {
  const result = await compile('.card { box-shadow: shadow(2); } .panel { box-shadow: elevation(named); }', { theme });
  assert.deepEqual(shadows(result.css), shadows(generateThemeCss(theme)));
  assert.match(result.css, /box-shadow: var\(--shadow-2\)/);
  assert.match(result.css, /box-shadow: var\(--shadow-named\)/);
});
test('Shadow boundaries preserve layers, inset and later rule persistence', () => {
  for (const width of [0, 799]) assert.equal(inspectShadowTheme(theme, width)['--shadow-2'], '0 2px 4px rgba(0,0,0,.12), inset 0 1px 2px rgba(0,0,0,.2)');
  for (const width of [800, 801, 1400]) assert.equal(inspectShadowTheme(theme, width)['--shadow-2'], '0 6px 16px rgba(0,0,0,.18)');
});
test('legacy Shadows use shared rules; JSON wins and definitions do not leak', async () => {
  const legacy = await compile(`@theme { shadow-2: ${expression}; } .card { box-shadow: shadow(2); }`, { breakpoints: { xs:0, sm:480, md:800, lg:1024, xl:1280 } });
  assert.deepEqual(shadows(legacy.css), shadows(generateShadowCss({ breakpoints: theme.breakpoints, shadows: {2:expression} })));
  const overridden = await compile('@theme { shadow-2: 0 99px 99px red; } .card { box-shadow: shadow(2); }', {theme});
  assert(!overridden.css.includes('99px'));
  assert(!(await compile('.card { box-shadow: shadow(2); }')).css.includes('99px'));
});
test('nested CSS, token dependencies, commas and zero preset survive', () => {
  const css = generateShadowCss({shadows:{custom:'inset 0 calc(space(2) + 1px) 3px palette(surface.main), 0 1px 2px color(gray.300)'}});
  assert(css.includes('calc(var(--space-2) + 1px)'));
  assert(css.includes('var(--ds__palette__surface-main)'));
  assert(css.includes('var(--ds__color__gray-300)'));
  assert.equal(inspectShadowTheme({},0)['--shadow-0'],'none');
});
test('invalid Shadow updates fail without mutating the input', async () => {
  for (const shadows of [[], {2:''}, {2:'md(none)'}, {2:'tablet(none)'}, {2:'xs(rgba(0,0,0,.2)'}, {2:42}]) {
    const bad={shadows};const before=JSON.stringify(bad);
    assert.throws(()=>generateShadowCss(bad));assert.equal(JSON.stringify(bad),before);
    assert.equal(validateAndNormalizeTheme(bad).ok,false);
  }
  await assert.rejects(compile('.bad {box-shadow: shadow(99)}'));
  assert.throws(()=>inspectShadowTheme(theme,-1));
});
test('regeneration and scoped previews remove stale transitions', () => {
  const next={...theme,breakpoints:{xs:0,md:950},shadows:{2:'none'}};
  const css=generateShadowCss(next,undefined,'#preview');
  assert(css.includes('#preview'));assert(!css.includes(':root'));assert(!css.includes('800px'));assert(!css.includes('950px'));
  assert.equal(inspectShadowTheme(next,900)['--shadow-2'],'none');
});
