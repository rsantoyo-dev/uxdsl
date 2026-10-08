const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const exported = require('../dist/plugin');
const plugin = exported.default || exported;
const { generateShadowCss, inspectShadowTheme } = require('../dist/shadows');
const { generateThemeCss } = require('../dist/ds-runtime/theme-generator');
const { validateTheme } = require('../dist/ds-runtime/theme-validate');
// Full 1-16 spacing plus the palette families the always-on density/surface/
// button/input defaults need, so strict reference validation (every :root
// block the plugin always emits, not just what this file's source uses)
// passes. See docs/features/FEAT-002-beta-migration-hardening.md.
const FULL_SPACING = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i + 1, `${(i + 1) * 4}px`]));
const BASE_PALETTE = { primary: { main: '#123', dark: '#111', contrast: '#fff' }, surface: { main: '#fff', dark: '#eee', contrast: '#000' }, neutral: { main: '#999', dark: '#333' }, error: { main: '#f00' } };
const expression = 'xs(0 2px 4px rgba(0,0,0,.12), inset 0 1px 2px rgba(0,0,0,.2)) md(0 6px 16px rgba(0,0,0,.18))';
const theme = { breakpoints: { xs: 0, md: 800 }, spacing: FULL_SPACING, palette: BASE_PALETTE, shadows: { 2: expression, named: 'none' } };
const compile = (source, options = {}) => postcss([plugin(options)]).process(source, { from: undefined });
function shadows(css) {
  const result = [];
  postcss.parse(css).walkDecls(/^--uxdsl__shadow__/, d => result.push([d.parent.parent.type === 'atrule' ? d.parent.parent.params : 'base', d.prop, d.value]));
  return result;
}
test('Shadow JSON has equivalent build/runtime output; references are preserved', async () => {
  const result = await compile('.card { box-shadow: shadow(2); } .panel { box-shadow: shadow(named); }', { theme });
  assert.deepEqual(shadows(result.css), shadows(generateThemeCss(theme)));
  assert.match(result.css, /box-shadow: var\(--uxdsl__shadow__2\)/);
  assert.match(result.css, /box-shadow: var\(--uxdsl__shadow__named\)/);
});
test('Shadow boundaries preserve layers, inset and later rule persistence', () => {
  for (const width of [0, 799]) assert.equal(inspectShadowTheme(theme, width)['--uxdsl__shadow__2'], '0 2px 4px rgba(0,0,0,.12), inset 0 1px 2px rgba(0,0,0,.2)');
  for (const width of [800, 801, 1400]) assert.equal(inspectShadowTheme(theme, width)['--uxdsl__shadow__2'], '0 6px 16px rgba(0,0,0,.18)');
});
test('Shadows compile from the JSON through the shared rules; a @theme pack fails and definitions do not leak', async () => {
  // The threshold is the theme's (`md: 800` over the base map).
  const built = await compile('.card { box-shadow: shadow(2); }', { theme: { breakpoints: { md: 800 }, spacing: FULL_SPACING, palette: BASE_PALETTE, shadows: { 2: expression } } });
  assert.deepEqual(shadows(built.css), shadows(generateShadowCss({ breakpoints: theme.breakpoints, shadows: {2:expression} })));
  await assert.rejects(() => compile('@theme { shadow-2: 0 99px 99px red; } .card { box-shadow: shadow(2); }', {theme}), /UXD_THEME_BLOCK_REMOVED/);
  const first = await compile('.card { box-shadow: shadow(2); }', { theme: { spacing: FULL_SPACING, palette: BASE_PALETTE, shadows: { 2: '0 99px 99px red' } } });
  assert(first.css.includes('99px'));
  assert(!(await compile('.card { box-shadow: shadow(2); }', { theme: { spacing: FULL_SPACING, palette: BASE_PALETTE } })).css.includes('99px'));
});
test('nested CSS, token dependencies, commas and zero preset survive', () => {
  const css = generateShadowCss({shadows:{custom:'inset 0 calc(space(2) + 1px) 3px palette(surface.main), 0 1px 2px color(gray.300)'}});
  assert(css.includes('calc(var(--uxdsl__space__2) + 1px)'));
  assert(css.includes('var(--uxdsl__palette__surface-main)'));
  assert(css.includes('var(--uxdsl__color__gray-300)'));
  assert.equal(inspectShadowTheme({},0)['--uxdsl__shadow__0'],'none');
});
test('invalid Shadow updates fail without mutating the input', async () => {
  for (const shadows of [[], {2:''}, {2:'md(none)'}, {2:'tablet(none)'}, {2:'xs(rgba(0,0,0,.2)'}, {2:42}]) {
    const bad={shadows};const before=JSON.stringify(bad);
    assert.throws(()=>generateShadowCss(bad));assert.equal(JSON.stringify(bad),before);
    assert.equal(validateTheme(bad).ok,false);
  }
  await assert.rejects(compile('.bad {box-shadow: shadow(99)}'));
  assert.throws(()=>inspectShadowTheme(theme,-1));
});
test('regeneration and scoped previews remove stale transitions', () => {
  const next={...theme,breakpoints:{xs:0,md:950},shadows:{2:'none'}};
  const css=generateShadowCss(next,undefined,'#preview');
  assert(css.includes('#preview'));assert(!css.includes(':root'));assert(!css.includes('800px'));assert(!css.includes('950px'));
  assert.equal(inspectShadowTheme(next,900)['--uxdsl__shadow__2'],'none');
});
