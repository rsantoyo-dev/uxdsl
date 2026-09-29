// Probe harness. Usage: node h.js '<css>' [jsonOpts]   or   node h.js -f file.uxdsl [jsonOpts]
// Prints: compiled CSS (author part only unless FULL=1) or error code+message.
const path = '/Users/ricardosantoyo/Documents/projects/uxdsl/packages/postcss-uxdsl';
const postcss = require(path + '/node_modules/postcss');
const uxdsl = require(path + '/dist/index.js');
const fs = require('fs');
let css = process.argv[2];
let optsArg = process.argv[3];
if (css === '-f') { css = fs.readFileSync(optsArg, 'utf8'); optsArg = process.argv[4]; }
const opts = Object.assign({ theme: {}, discoverTheme: false, includeTheme: false }, optsArg ? JSON.parse(optsArg) : {});
if (process.env.INCLUDE_THEME === '1') opts.includeTheme = true;
if (process.env.REF_OFF === '1') opts.references = { mode: 'off' };
if (process.env.REF_WARN === '1') opts.references = { mode: 'warn', onWarning: (i) => console.log('WARN:', i.message) };
try {
  const r = postcss([uxdsl(opts)]).process(css, { from: 'probe.uxdsl' });
  const out = r.css;
  const warnings = r.warnings();
  for (const w of warnings) console.log('[warning]', w.text);
  console.log(out);
} catch (e) {
  const msg = e.message || String(e);
  console.log('ERROR', e.name, '|', msg.split('\n').slice(0, 6).join('\n'));
  if (e.line) console.log('  at line', e.line, 'col', e.column, e.file || '');
}
