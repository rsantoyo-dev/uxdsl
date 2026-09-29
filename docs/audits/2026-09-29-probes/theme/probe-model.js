const path = require('path');
const PKG = '/Users/ricardosantoyo/Documents/projects/uxdsl/packages/postcss-uxdsl';
const postcss = require(path.join(PKG, 'node_modules/postcss'));
const uxdsl = require(path.join(PKG, 'dist/index.js'));
const rt = require(path.join(PKG, 'dist/ds-runtime.js'));
const grab = (css, re) => (css.match(re) || []).slice(0, 4).join('  ');
function compile(theme, css = '.a { color: palette(primary); }') {
  try { return postcss([uxdsl({ theme, discoverTheme: false })]).process(css, { from: undefined }).css; }
  catch (e) { return 'THROWS ' + e.message.replace(/\s+/g, ' ').slice(0, 200); }
}
console.log('--- 1. token functions inside palette/colors/spacing values (foundations emit raw)');
for (const t of [
  { palette: { brand: { main: 'palette(primary.main)', dark: 'palette(primary.dark)', contrast: '#fff' } } },
  { palette: { brand: { main: 'color(gray.500)' } } },
  { colors: { accent: { '500': 'palette(primary.main)' } } },
  { spacing: { '17': 'space(16)' } },
  { spacing: { '17': 'calc(space(16) * 2)' } },
  { fonts: { families: { ui2: 'var(--uxdsl__font__ui)' } } },
]) {
  const out = compile(t);
  console.log(JSON.stringify(t).slice(0, 80), '=>', typeof out === 'string' && out.startsWith('THROWS') ? out : grab(out, /--uxdsl__(palette__brand-main|palette__brand-dark|color__accent-500|space__17|font__ui2): [^;]*;/g));
}
console.log('\n--- 2. tone substitution depends on the literal var(--uxdsl__button__tone-*, var(--uxdsl__palette__primary-*)) pattern');
const a = compile({ buttons: { contained: { states: { hover: { bg: 'palette(primary.dark)' } } } } }, '.b { @ds-button(contained success); }');
console.log('hover.bg written as palette(primary.dark):', grab(a, /--uxdsl__button__contained-tone-success-hover-bg: [^;]*;/g), '| component:', grab(a, /\.b:hover \{[^}]*\}/g));
const b = compile({}, '.b { @ds-button(contained success); }');
console.log('base.json literal form           :', grab(b, /--uxdsl__button__contained-tone-success-hover-bg: [^;]*;/g));
console.log('\n--- 3. legacy `typography` family emits un-namespaced vars');
console.log(grab(compile({}), /--font-code: [^;]*;/g) || '(none)');
console.log('\n--- 4. surfaces accept both palette(surface-main) and palette(surface.main):', grab(compile({ surfaces: { flat: { color: 'palette(surface.contrast)' } } }), /--uxdsl__surface__flat-color: [^;]*;/g));
console.log('\n--- 5. build vs generateThemeCss divergence on fonts');
const t5 = { fonts: { families: { ui: 'Inter Tight, sans-serif' }, google: [''] } };
console.log('plugin      :', grab(compile(t5), /--uxdsl__font__ui: [^;]*;/g), '|', grab(compile(t5), /@import[^;]*;/g));
const v5 = rt.validateAndNormalizeTheme(rt.resolveTheme(t5));
console.log('runtime     :', grab(rt.generateThemeCss(v5.theme), /--uxdsl__font__ui: [^;]*;/g), '|', grab(rt.generateThemeCss(v5.theme), /@import[^;]*;/g) || '(no @import)');
console.log('\n--- 6. tone loss through null is not detected by the structural gate');
function makeDocument() { const byId = new Map(); return { createElement(tag) { const at = {}; return { tagName: tag.toUpperCase(), id: '', textContent: '', setAttribute(n, v) { at[n] = v; }, getAttribute(n) { return at[n] ?? null; } }; }, getElementById(id) { return byId.get(id) || null; }, head: { appendChild(n) { if (n.id) byId.set(n.id, n); return n; } } }; }
globalThis.document = makeDocument();
rt.__resetThemeStateForTests();
console.log('init with brand tone:', rt.applyTheme({ palette: { brand: { main: '#111', dark: '#000', contrast: '#fff' } } }, { replace: true }).ok);
const r = rt.applyTheme({ palette: { brand: { dark: null } } });
console.log('patch brand.dark=null ->', r.ok ? 'ACCEPTED; emitted: ' + grab(document.getElementById('uxdsl-theme').textContent, /--uxdsl__palette__brand-dark: [^;]*;|--uxdsl__button__contained-tone-brand-hover-bg: [^;]*;/g) : r.error.code);
console.log('getToneFamilies with dark:null ->', require(path.join(PKG, 'dist/language.js')).getToneFamilies({ brand: { main: '#111', dark: null, contrast: '#fff' } }));
console.log('\n--- 7. what modes emits');
console.log(grab(rt.generateThemeCss({}), /@media \(prefers-color-scheme: dark\) \{ :root:not\(\[data-theme='light'\]\) \{ --uxdsl__palette__primary-main: [^;]*;|:root\[data-theme='dark'\] \{ --uxdsl__palette__primary-main: [^;]*;/g));
console.log('\n--- 8. colors: does the base palette reference colors at all?');
const base = rt.DEFAULT_THEME;
const refs = JSON.stringify(base.palette).match(/var\(--uxdsl__color__[^)]*\)/g) || [];
console.log('palette -> color refs in base.json:', refs.length, '; colors families:', Object.keys(base.colors));
console.log('\n--- 9. plugin `breakpoints` option replaces theme.breakpoints wholesale?');
console.log(grab(compile({ breakpoints: { md: 800 } }, '.a { padding: xs(1px) md(2px); }'), /@media \(min-width: (800|768)px\)/g));
try { console.log(grab(postcss([uxdsl({ theme: { breakpoints: { md: 800 } }, breakpoints: { xs: 0, sm: 480, lg: 1024, xl: 1280 }, discoverTheme: false })]).process('.a { padding: xs(1px) md(2px); }', { from: undefined }).css, /@media[^{]*|UXD[^ ]*/g)); } catch (e) { console.log('option+theme conflict:', e.message.slice(0, 160)); }
console.log('\n--- 10. densities() plural legacy function still compiles?');
console.log(compile({}, '.a { padding: densities(1, 2, 3); }').match(/\.a \{[^}]*\}/g)?.slice(0, 2).join(' '));
