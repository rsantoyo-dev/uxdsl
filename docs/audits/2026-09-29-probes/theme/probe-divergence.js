const path = require('path');
const PKG = '/Users/ricardosantoyo/Documents/projects/uxdsl/packages/postcss-uxdsl';
const rt = require(path.join(PKG, 'dist/ds-runtime.js'));
const grab = (css, re) => (css.match(re) || []).slice(0, 4).join('  ') || '(no match)';
console.log('--- generateThemeCss (runtime/SSR) with token functions inside foundation values');
for (const t of [
  { palette: { brand: { main: 'palette(primary.main)', dark: 'color(gray.500)', contrast: '#fff' } } },
  { spacing: { '17': 'calc(space(16) * 2)' } },
  { colors: { accent: { '500': 'palette(primary.main)' } } },
]) {
  try {
    const css = rt.generateThemeCss(t);
    console.log(JSON.stringify(t).slice(0, 70), '=>', grab(css, /--uxdsl__(palette__brand-main|palette__brand-dark|space__17|color__accent-500): [^;]*;/g));
  } catch (e) { console.log(JSON.stringify(t).slice(0, 70), '=> THROWS', e.message.slice(0, 160)); }
}
console.log('\n--- applyTheme with palette() inside a palette value (what a runtime editor would send)');
function makeDocument() { const byId = new Map(); return { createElement(tag) { const at = {}; return { tagName: tag.toUpperCase(), id: '', textContent: '', setAttribute(n, v) { at[n] = v; }, getAttribute(n) { return at[n] ?? null; } }; }, getElementById(id) { return byId.get(id) || null; }, head: { appendChild(n) { if (n.id) byId.set(n.id, n); return n; } } }; }
globalThis.document = makeDocument();
rt.__resetThemeStateForTests();
rt.applyTheme({}, { replace: true });
const r = rt.applyTheme({ palette: { brand: { main: 'palette(primary.main)' } } });
console.log(r.ok ? 'ACCEPTED; emitted ' + grab(document.getElementById('uxdsl-theme').textContent, /--uxdsl__palette__brand-main: [^;]*;/g) : r.error.code + ' ' + r.error.message.slice(0, 200));

console.log('\n--- uxdsl-core compile(): does the /*@uxdsl-bp*/ marker follow theme.breakpoints?');
(async () => {
  const core = require('/Users/ricardosantoyo/Documents/projects/uxdsl/packages/uxdsl-core/dist/index.js');
  const { css } = await core.compile({ source: '.a { padding: xs(1px) md(2px); }', from: '/tmp/x.uxdsl' }, { theme: { breakpoints: { md: 800 } } });
  console.log('media:', grab(css, /@media \(min-width: \d+px\) \{ \.a/g), '| marker:', grab(css, /\/\*@uxdsl-bp [^*]*\*\//g));
  const withOpt = await core.compile({ source: '.a { padding: xs(1px) md(2px); }', from: '/tmp/x.uxdsl' }, { theme: { breakpoints: { md: 800 } }, breakpoints: { xs: 0, sm: 480, md: 800, lg: 1024, xl: 1280 } });
  console.log('with explicit breakpoints option -> marker:', grab(withOpt.css, /\/\*@uxdsl-bp [^*]*\*\//g));
})();
