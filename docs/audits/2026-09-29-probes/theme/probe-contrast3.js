const path = require('path');
const PKG = '/Users/ricardosantoyo/Documents/projects/uxdsl/packages/postcss-uxdsl';
const { checkThemeContrast, resolveTheme, contrastRatio, parseLiteralColor } = require(path.join(PKG, 'dist/ds-runtime.js'));
const exceptions = require(path.join(PKG, 'src/theme/base.contrast-exceptions.json'));
const cr = (a, b) => contrastRatio(parseLiteralColor(a), parseLiteralColor(b)).toFixed(2);
console.log('dark-mode warning candidates: #000 on #f59e0b', cr('#000', '#f59e0b'), '| #000 on #fbbf24', cr('#000', '#fbbf24'), '| #f59e0b on #020617', cr('#f59e0b', '#020617'));
console.log('dark-mode light.dark candidate #334155 with contrast #f8fafc:', cr('#f8fafc', '#334155'));
const fix = {
  palette: { warning: { main: '#b45309', dark: '#92400e', contrast: '#ffffff' } },
  modes: { dark: { palette: {
    warning: { main: '#fbbf24', dark: '#f59e0b', contrast: '#000000' },
    neutral: { dark: '#94a3b8' },
    light: { dark: '#334155' },
  } } },
};
const r = checkThemeContrast(resolveTheme(fix), { exceptions });
const isIdentity = (f) => ['light', 'dark', 'surface'].includes(f.tone);
const identity = r.failures.filter(isIdentity);
const other = r.failures.filter((f) => !isIdentity(f));
console.log(`\nafter value fixes: failures=${r.failures.length}; identity-tone=${identity.length}; non-identity=${other.length}; exceptionIssues=${r.exceptionIssues}`);
for (const f of other) console.log('  non-identity:', f.mode, f.family, f.component, 'tone=' + f.tone, f.state, f.pair, f.ratio && f.ratio.toFixed(2));
const groups = {};
for (const f of identity) { const k = `${f.family}.${f.component} ${f.pair} (tone.main drawn as ${f.pair}${f.state === 'focus' ? ' on focus' : ''})`; groups[k] = (groups[k] || 0) + 1; }
console.log('\nidentity-tone failures grouped (what a pattern exception must cover):');
for (const [k, n] of Object.entries(groups).sort((a, b) => b[1] - a[1])) console.log('  ', n, k);
const byStateComp = {};
for (const f of identity) { const k = `${f.component}/${f.state}/${f.pair}`; byStateComp[k] = (byStateComp[k] || 0) + 1; }
console.log('\nby component/state/pair:', Object.entries(byStateComp).sort((a, b) => b[1] - a[1]));
// sanity: are all identity failures explainable as "tone.main (or tone.dark) equals/near ambient bg"?
console.log('\nsample identity failures:');
for (const f of identity.slice(0, 6)) console.log('  ', f.mode, f.family, f.component, f.tone, f.state, f.pair, f.ratio && f.ratio.toFixed(2));
// D-8 (b) simulation: what if identity families were simply not tones? (only useful to size the alternative)
const noToneFix = JSON.parse(JSON.stringify(fix));
// can't remove keys via override; emulate by checking count of identity failures = 88+7
console.log('\nD-8(b) would need the engine to refuse identity tones for outlined/flat/underline AND for the focus border of contained; identity failures on contained:', identity.filter((f) => f.component === 'contained').length);
