const path = '/Users/ricardosantoyo/Documents/projects/uxdsl/packages/postcss-uxdsl';
const postcss = require(path + '/node_modules/postcss');
const uxdsl = require(path + '/dist/index.js');
const rt = require(path + '/dist/ds-runtime.js');
const css = '.a { color: red; }';
const out = postcss([uxdsl({ theme: {}, discoverTheme: false })]).process(css, { from: 'x.uxdsl' }).css;
const props = out.match(/--[\w-]+\s*:/g) || [];
const uniq = new Set(props.map(p => p.replace(/\s*:$/, '')));
console.log('bytes', Buffer.byteLength(out));
console.log('custom property declarations', props.length, 'unique names', uniq.size);
console.log(':root blocks', (out.match(/:root/g) || []).length);
console.log('@media blocks', (out.match(/@media/g) || []).length);
console.log('@import lines', (out.match(/@import/g) || []).length);
const fam = {};
for (const p of uniq) { const m = p.match(/^--uxdsl__(\w+?)__/); const k = m ? m[1] : p; fam[k] = (fam[k] || 0) + 1; }
console.log('unique names by family', fam);
const famDecl = {};
for (const p of props) { const m = p.match(/^--uxdsl__(\w+?)__/); const k = m ? m[1] : p.replace(/\s*:$/, ''); famDecl[k] = (famDecl[k] || 0) + 1; }
console.log('declarations by family', famDecl);
const nonNs = [...uniq].filter(p => !p.startsWith('--uxdsl__'));
console.log('non-namespaced names', nonNs);
// tone bloat
const toneVars = [...uniq].filter(p => /-tone-/.test(p));
console.log('tone-variant names', toneVars.length);
// the first 1500 chars
console.log('--- head ---');
console.log(out.slice(0, 1500));
console.log('--- tail ---');
console.log(out.slice(-600));
// generateThemeCss parity
const gen = rt.generateThemeCss({});
console.log('generateThemeCss bytes', Buffer.byteLength(gen));
const genProps = gen.match(/--[\w-]+\s*:/g) || [];
console.log('generateThemeCss decls', genProps.length);
// legacy @theme surface: what does plugin emit for the *dark* block ordering
const darkIdx = out.indexOf('prefers-color-scheme');
console.log('dark block index', darkIdx, 'of', out.length);
