const path = require('path');
const PKG = '/Users/ricardosantoyo/Documents/projects/uxdsl/packages/postcss-uxdsl';
const { checkThemeContrast, resolveTheme } = require(path.join(PKG, 'dist/ds-runtime.js'));
const exceptions = require(path.join(PKG, 'src/theme/base.contrast-exceptions.json'));
const r = checkThemeContrast(resolveTheme(), { exceptions });
console.log('passed', r.passed, 'failures', r.failures.length, 'checked', r.checked.length, 'exceptionIssues', r.exceptionIssues);
const by = (fn) => { const m = {}; for (const f of r.failures) { const k = fn(f); m[k] = (m[k] || 0) + 1; } return Object.entries(m).sort((a, b) => b[1] - a[1]); };
console.log('\nby tone:', by((f) => f.tone));
console.log('by family:', by((f) => f.family));
console.log('by pair:', by((f) => f.pair));
console.log('by mode:', by((f) => f.mode));
console.log('by component:', by((f) => f.family + '.' + f.component));
console.log('by state:', by((f) => f.state));
const identity = r.failures.filter((f) => ['light', 'dark', 'surface'].includes(f.tone));
const warning = r.failures.filter((f) => f.tone === 'warning');
const untoned = r.failures.filter((f) => f.tone === null);
const rest = r.failures.filter((f) => !identity.includes(f) && !warning.includes(f) && !untoned.includes(f));
console.log('\nidentity tones (D-8):', identity.length, ' warning (D-9):', warning.length, ' untoned:', untoned.length, ' other:', rest.length);
console.log('\nuntoned failures:');
for (const f of untoned) console.log(' ', f.mode, f.family, f.component, f.state, f.pair, f.ratio && f.ratio.toFixed(2), f.reason);
console.log('\nother failures:');
for (const f of rest) console.log(' ', f.mode, f.family, f.component, 'tone=' + f.tone, f.state, f.pair, f.ratio && f.ratio.toFixed(2), f.reason);
console.log('\nwarning failures:');
for (const f of warning) console.log(' ', f.mode, f.family, f.component, f.state, f.pair, f.ratio && f.ratio.toFixed(2));
console.log('\nidentity-tone failures by (tone, mode, pair):', by((f) => ['light', 'dark', 'surface'].includes(f.tone) ? `${f.tone}/${f.mode}/${f.pair}` : 'n/a').filter(([k]) => k !== 'n/a'));
// unresolved?
console.log('\nunresolved:', r.failures.filter((f) => f.ratio === null).length);
// what would pass if identity tones were excluded from tone enumeration for text roles AND warning excepted?
console.log('\nremaining if D-8(b) (drop light/dark/surface as tones) and D-9 fixed:', r.failures.length - identity.length - warning.length);
// ratio stats for warning
console.log('warning ratios:', warning.map((f) => f.ratio && f.ratio.toFixed(2)).join(', '));
// which checked pairs are exempt (disabled)
console.log('exempt checked pairs:', r.checked.filter((c) => c.exempt).length, 'of', r.checked.length);
