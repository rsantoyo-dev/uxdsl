const path = '/Users/ricardosantoyo/Documents/projects/uxdsl/packages/postcss-uxdsl';
const postcss = require(path + '/node_modules/postcss');
const uxdsl = require(path + '/dist/index.js');
function run(label, theme, css = '.a { color: red; }', extra = {}) {
  console.log('=== ' + label);
  try {
    const out = postcss([uxdsl({ theme, discoverTheme: false, includeTheme: true, ...extra })]).process(css, { from: 'probe.uxdsl' }).css;
    const grep = extra.grep || /primary-main|space__1:|brand|gray-300|font__ui|shadow__x|hack|font-code/;
    const hits = out.split(/(?<=;)|(?<=\})/).filter(s => grep.test(s)).map(s => s.trim()).slice(0, 8);
    console.log(hits.join('\n'));
    if (extra.count) console.log('total bytes', out.length, 'errors: none');
  } catch (e) {
    const msg = (e.message || String(e)).split('\n');
    console.log('ERROR', e.name, '|', msg.slice(0, 3).join(' // '), msg.length > 3 ? `... (+${msg.length - 3} more lines)` : '');
    if (e.issues) console.log('  issue count:', e.issues.length);
  }
  console.log();
}
run('spacing.1 = 4 (number)', { spacing: { '1': 4 } });
run('palette.primary.main = 5', { palette: { primary: { main: 5 } } });
run('palette.primary.main = {x:1}', { palette: { primary: { main: { x: 1 } } } });
run('palette.primary.main = null', { palette: { primary: { main: null } } });
run('palette.primary.main = ""', { palette: { primary: { main: '' } } });
run('palette.primary.main = injection', { palette: { primary: { main: 'red; } .hack { color: blue' } } }, '.a { color: red; }', { grep: /hack|primary-main/ });
run('colors.brand = [1,2]', { colors: { brand: [1, 2] } });
run('fonts.families.ui = 5', { fonts: { families: { ui: 5 } } });
run('fonts.families.ui = {}', { fonts: { families: { ui: {} } } });
run('shadows.x = xs(none) md(shadow(1))', { shadows: { x: 'xs(none) md(shadow(1))' } }, '.a { box-shadow: shadow(x); }');
run('radii.x = radius(2)', { radii: { x: 'radius(2)' } }, '.a { border-radius: radius(x); }', { grep: /radius__x/ });
run('borders.x = border(1)', { borders: { x: 'border(1)' } }, '.a { border: border(x); }', { grep: /border__x/ });
run('densities.x = density(2)', { densities: { x: 'density(2)' } }, '.a { padding: density(x); }', { grep: /density__x/ });
run('surfaces.contained.bg = palette(nope) — cascade count', { surfaces: { contained: { bg: 'palette(nope)' } } });
run('palette.primary removed (null) — cascade count', { palette: { primary: null } });
run('palette.neutral = null — cascade count', { palette: { neutral: null } });
run('opts.breakpoints {a:0,b:500} with base typography', {}, '.a { padding: a(1px) b(2px); }', { breakpoints: { a: 0, b: 500 } });
run('opts.breakpoints [["xs",0],["md",700]]', {}, '.a { padding: xs(1px) md(2px); }', { breakpoints: [['xs', 0], ['md', 700]], grep: /min-width|padding: 2px/ });
run('theme.breakpoints md:700 (merge)', { breakpoints: { md: 700 } }, '.a { padding: xs(1px) md(2px) sm(9px); }', { grep: /\.a/ });
run('modes.dark = null', { modes: { dark: null } }, '.a { color: red; }', { grep: /prefers-color-scheme|data-theme/ });
run('modes.dark.palette.primary.main = 5', { modes: { dark: { palette: { primary: { main: 5 } } } } }, '.a { color: red; }', { grep: /prefers|primary-main: 5/ });
run('fonts.google with quote', { fonts: { google: ["Inter'); } .x { color: red"] } }, '.a { color: red; }', { grep: /@import|\.x/ });
run('fonts.families.ui with braces', { fonts: { families: { ui: 'a; } .hack { color: blue' } } }, '.a { color: red; }', { grep: /hack|font__ui/ });
run('typography flat family injection', { typography: { 'font-x': 'a; } .hack { color: blue' } }, '.a { color: red; }', { grep: /hack|font-x/ });
run('typography flat family basic', { typography: { 'hero': '2rem', 'uxdsl__space__1': '9px' } }, '.a { color: red; }', { grep: /--hero|space__1:/ });
run('@keyframes with responsive', {}, '@keyframes spin { from { width: xs(1px) md(2px); } }', { grep: /keyframes|@media \(min-width: 768px\) \{ from/ });
run('densities() consumer ref check', {}, '.a { gap: densities(99); }', { grep: /gap/ });
run('theme fonts.google = [] opt out', { fonts: { google: [] } }, '.a { color: red; }', { grep: /@import/ });
