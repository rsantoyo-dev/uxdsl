const path = require('path');
const PKG = '/Users/ricardosantoyo/Documents/projects/uxdsl/packages/postcss-uxdsl';
const { checkThemeContrast, resolveTheme, contrastRatio, parseLiteralColor } = require(path.join(PKG, 'dist/ds-runtime.js'));
const exceptions = require(path.join(PKG, 'src/theme/base.contrast-exceptions.json'));
const cr = (a, b) => contrastRatio(parseLiteralColor(a), parseLiteralColor(b)).toFixed(2);
console.log('current warning: main #d97706 on white', cr('#d97706', '#ffffff'), '| dark #c25e0a on white', cr('#c25e0a', '#ffffff'), '| contrast #000 on main', cr('#000000', '#d97706'));
for (const [main, dark, contrast] of [['#b45309', '#92400e', '#ffffff'], ['#b45309', '#92400e', '#000000'], ['#a16207', '#854d0e', '#ffffff'], ['#c2410c', '#9a3412', '#ffffff']]) {
  console.log(`candidate warning main=${main} dark=${dark} contrast=${contrast}: main/white ${cr(main, '#fff')}, dark/white ${cr(dark, '#fff')}, contrast/main ${cr(contrast, main)}, contrast/dark ${cr(contrast, dark)}`);
}
console.log('\ncurrent dark-mode neutral: dark #475569 on surface.main #020617', cr('#475569', '#020617'), '| contrast #000 on dark', cr('#000000', '#475569'));
for (const nd of ['#94a3b8', '#a3b1c6', '#cbd5e1']) console.log(`candidate modes.dark.neutral.dark=${nd}: on #020617 ${cr(nd, '#020617')}, #000 on it ${cr('#000000', nd)}`);

function run(label, override, opts = {}) {
  const r = checkThemeContrast(resolveTheme(override), { exceptions });
  const identity = r.failures.filter((f) => ['light', 'dark', 'surface'].includes(f.tone) && ['outlined', 'flat', 'underline'].includes(f.component));
  console.log(`\n${label}: failures=${r.failures.length}, of which identity-tone×text-role=${identity.length}, other=${r.failures.length - identity.length}, exceptionIssues=${r.exceptionIssues.length}`);
  const other = r.failures.filter((f) => !identity.includes(f));
  for (const f of other) console.log('  ', f.mode, f.family, f.component, 'tone=' + f.tone, f.state, f.pair, f.ratio && f.ratio.toFixed(2));
  return r;
}
run('baseline', {});
run('D-9(b) warning={#b45309,#92400e,#fff} + neutral.dark(dark mode)=#94a3b8', {
  palette: { warning: { main: '#b45309', dark: '#92400e', contrast: '#ffffff' } },
  modes: { dark: { palette: { neutral: { dark: '#94a3b8' } } } },
});
