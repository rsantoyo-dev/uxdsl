const path = '/Users/ricardosantoyo/Documents/projects/uxdsl/packages/postcss-uxdsl';
const postcss = require(path + '/node_modules/postcss');
const uxdsl = require(path + '/dist/index.js');
const rt = require(path + '/dist/ds-runtime.js');
function plugin(theme, css = '.a { color: red; }', extra = {}) {
  return postcss([uxdsl({ theme, discoverTheme: false, includeTheme: true, ...extra })]).process(css, { from: 'probe.uxdsl' }).css;
}
function grepLine(out, re) { return out.split(/(?<=;)|(?<=\})/).filter(s => re.test(s)).map(s => s.trim()); }
const cases = [
  ['radii.x = radius(2)', { radii: { x: 'radius(2)' } }, /radius__x:/],
  ['shadows.x = xs(none) md(shadow(1))', { shadows: { x: 'xs(none) md(shadow(1))' } }, /shadow__x:/],
  ['densities.x = density(2)', { densities: { x: 'density(2)' } }, /density__x:/],
  ['borders.x = border(1)', { borders: { x: 'border(1)' } }, /border__x:/],
  ['surfaces.contained.padding = space(3)', { surfaces: { contained: { padding: 'space(3)' } } }, /contained-padding:/],
  ['typography_details.h1.fontSize = density(4)', { typography_details: { h1: { fontSize: 'density(4)' } } }, /h1-size:/],
  ['typography_details.h1.letterSpacing = palette(primary)', { typography_details: { h1: { letterSpacing: 'palette(primary)' } } }, /h1-spacing:/],
  ['spacing.gutter = space(2)', { spacing: { gutter: 'space(2)' } }, /space__gutter:/],
  ['palette.brand.main = color(gray.300)', { palette: { brand: { main: 'color(gray.300)' } } }, /brand-main:/],
  ['palette.brand.main = palette(primary, 0.5)', { palette: { brand: { main: 'palette(primary, 0.5)' } } }, /brand-main:/],
  ['colors.x.1 = palette(primary)', { colors: { x: { '1': 'palette(primary)' } } }, /color__x-1:/],
  ['fonts.families.ui = var(--uxdsl__font__code)', { fonts: { families: { ui: 'var(--uxdsl__font__code)' } } }, /font__ui:/],
];
for (const [label, theme, re] of cases) {
  console.log('=== ' + label);
  let p, r;
  try { p = grepLine(plugin(theme), re); } catch (e) { p = ['ERROR ' + (e.message || '').split('\n')[0].slice(0, 160)]; }
  try { r = grepLine(rt.generateThemeCss(theme), re); } catch (e) { r = ['ERROR ' + (e.message || '').split('\n')[0].slice(0, 160)]; }
  console.log('  plugin :', p.join(' | '));
  console.log('  runtime:', r.join(' | '));
  console.log('  parity :', JSON.stringify(p) === JSON.stringify(r) ? 'SAME' : 'DIFFERENT');
}
// idempotency
console.log('\n=== idempotency (includeTheme:false)');
const src = '.a { @ds-button(contained primary 2); padding: xs(space(1)) md(space(2)); color: palette(primary, 0.5); }';
const once = postcss([uxdsl({ theme: {}, discoverTheme: false, includeTheme: false })]).process(src, { from: 'a.uxdsl' }).css;
const twice = postcss([uxdsl({ theme: {}, discoverTheme: false, includeTheme: false })]).process(once, { from: 'a.uxdsl' }).css;
console.log(once === twice ? 'SAME' : 'DIFFERENT\n' + once + '\n---\n' + twice);
// validateAndNormalizeTheme on bad palette/spacing
console.log('\n=== validateAndNormalizeTheme');
for (const t of [{ palette: { primary: { main: 5 } } }, { palette: { primary: { main: { x: 1 } } } }, { spacing: { '1': 4 } }, { palette: { primary: { main: 'red; } .hack { color: blue' } } }, { typography: { 'font-x': 'a; } .hack{}' } }, { modes: { dark: null } }, { fonts: { google: 'Inter' } }]) {
  const v = rt.validateAndNormalizeTheme(t);
  console.log(JSON.stringify(t).slice(0, 60), '-> ok:', v.ok, 'errors:', v.errors.map(e => e.path + ': ' + e.message.slice(0, 60)), 'warnings:', v.warnings.length);
}
// plugin unknown family warning?
console.log('\n=== plugin warnings for unknown family / bad shape');
const res = postcss([uxdsl({ theme: { palete: {}, modes: { light: {} } }, discoverTheme: false, includeTheme: false })]).process('.a{color:red}', { from: 'a.uxdsl' });
console.log('warnings:', res.warnings().length);
// theme-level shadow(1) inside shadow: check literal
console.log('\n=== shadow(1) inside shadows (plugin :root at md)');
console.log(grepLine(plugin({ shadows: { x: 'xs(none) md(shadow(1))' } }), /shadow__x/).join('\n'));
