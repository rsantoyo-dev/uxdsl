// Batch probe runner. Usage: node run.js probes.txt
// probes.txt: blocks separated by a line "----". Each block: optional first line starting with "@opts " (JSON), rest is CSS.
const path = '/Users/ricardosantoyo/Documents/projects/uxdsl/packages/postcss-uxdsl';
const postcss = require(path + '/node_modules/postcss');
const uxdsl = require(path + '/dist/index.js');
const fs = require('fs');
const text = fs.readFileSync(process.argv[2], 'utf8');
const blocks = text.split(/^----\s*$/m).map(b => b.trim()).filter(Boolean);
for (const block of blocks) {
  let lines = block.split('\n');
  let extra = {};
  if (lines[0].startsWith('@opts ')) { extra = JSON.parse(lines[0].slice(6)); lines = lines.slice(1); }
  const css = lines.join('\n');
  const opts = Object.assign({ theme: {}, discoverTheme: false, includeTheme: false }, extra);
  console.log('=== ' + css.replace(/\n/g, '\\n ').slice(0, 140) + (Object.keys(extra).length ? '   [opts ' + JSON.stringify(extra) + ']' : ''));
  try {
    const r = postcss([uxdsl(opts)]).process(css, { from: 'probe.uxdsl' });
    const out = r.css;
    for (const w of r.warnings()) console.log('[warning]', w.text);
    console.log(out.replace(/\n\s*\n/g, '\n'));
  } catch (e) {
    const msg = e.message || String(e);
    console.log('ERROR', e.name, '|', msg.split('\n').slice(0, 4).join(' // '));
    if (e.line) console.log('  at line', e.line, 'col', e.column);
  }
  console.log();
}
