const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const exported = require('../dist/index');
const plugin = exported.default || exported;
const { generateSurfaceCss, inspectSurfaceTheme, surfaceDeclarations, getSurfaceTokens } = require('../dist/surfaces');
const { generateThemeCss } = require('../dist/ds-runtime/theme-generator');
const { validateAndNormalizeTheme } = require('../dist/ds-runtime/theme-validate');
// Full 1-16 spacing plus the palette families the always-on density/surface/
// button/input defaults need, so strict reference validation (every :root
// block the plugin always emits, not just what this file's source uses)
// passes. See docs/features/FEAT-002-beta-migration-hardening.md.
const FULL_SPACING = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i + 1, `${(i + 1) * 4}px`]));
const BASE_PALETTE = { primary: { main: '#123', dark: '#111', contrast: '#fff' }, surface: { main: '#fff', dark: '#eee', contrast: '#000' }, neutral: { main: '#999', dark: '#333' }, error: { main: '#f00' } };
const withBaseline = (extra = {}) => ({ spacing: FULL_SPACING, palette: BASE_PALETTE, ...extra });
const theme = { breakpoints: { xs:0, md:800 }, spacing: FULL_SPACING, palette: { ...BASE_PALETTE, 'brand-blue': { main: 'blue', dark: 'navy', contrast: 'white' } }, surfaces: { contained: { shadow: 'xs(shadow(1)) md(shadow(3))', bg:'white' }, notice: { padding: '12px', border:'2px solid red' } } };
const compile=(source,options={})=>postcss([plugin(options)]).process(source,{from:undefined});
function declarations(css) {
 const result=[];postcss.parse(css).walkDecls(/^--surface-/,d=>result.push([d.parent.parent.type==='atrule'?d.parent.parent.params:'base',d.prop,d.value]));return result;
}
test('Surface variables match build/runtime output and preserve composition references',async()=>{
 const result=await compile('.card { @ds-surface(contained); } .notice { @ds-surface(notice); }',{theme});
 assert.deepEqual(declarations(result.css),declarations(generateThemeCss(theme)));
 assert(result.css.includes('border-radius: var(--surface-contained-radius)'));
 assert(result.css.includes('--surface-contained-radius: var(--radius-2)'));
 assert(result.css.includes('var(--surface-notice-padding)'));
});
test('Surface inspector preserves responsive boundaries and missing-field inheritance',()=>{
 assert.equal(getSurfaceTokens(theme).notice.radius,'radius(2)');
 for(const [width,shadow] of [[799,'var(--shadow-1)'],[800,'var(--shadow-3)'],[801,'var(--shadow-3)'],[1400,'var(--shadow-3)']]) assert.equal(inspectSurfaceTheme(theme,width)['--surface-contained-shadow'],shadow);
 assert.equal(inspectSurfaceTheme(theme,0)['--surface-notice-padding'],'12px');
});
test('tone and size composition matches compiled declarations',async()=>{
 for(const role of ['contained','outlined','flat','notice']) {
  const expected=surfaceDeclarations(theme,role,'primary','2');
  const css=(await compile(`.x { @ds-surface(${role} primary 2); }`,{theme})).css;
  const actual={};postcss.parse(css).walkRules('.x',r=>r.walkDecls(d=>actual[d.prop]=d.value));assert.deepEqual(actual,expected);
 }
 const hyphen=(await compile('.x { @ds-surface(contained brand-blue); }',{theme})).css; assert(hyphen.includes('var(--ds__palette__brand-blue-main)'));
 assert.equal(surfaceDeclarations(theme,'outlined','primary').border,'1px solid var(--ds__palette__primary-main)');
 assert.equal(surfaceDeclarations(theme,'flat','primary').border,'var(--surface-flat-border)');
});
test('legacy Surface definitions normalize to shared rules; JSON wins per field; no leakage',async()=>{
 const legacy='@theme { surface-contained: { bg: pink; padding: 11px; } } .x { @ds-surface(contained); }';
 const output=await compile(legacy,{theme:withBaseline({surfaces:{contained:{bg:'white'}}})});
 assert(output.css.includes('--surface-contained-bg: white'));
 assert(output.css.includes('--surface-contained-padding: 11px'));
 assert(!(await compile('.x { @ds-surface(contained); }',{theme:withBaseline()})).css.includes('11px'));
 assert.deepEqual(declarations((await compile(legacy,{theme:withBaseline()})).css),declarations(generateSurfaceCss(withBaseline({surfaces:{contained:{bg:'pink',padding:'11px'}}}))));
});
test('invalid Surface roles, fields, references and expressions are rejected',async()=>{
 for(const bad of [{surfaces:{contained:null}},{surfaces:[]},{surfaces:{contained:{unknown:'1px'}}},{surfaces:{contained:{shadow:'md(shadow(1))'}}},{surfaces:{contained:{radius:'radius(99)'}}},{surfaces:{contained:{bg:''}}}]) {
  assert.throws(()=>generateSurfaceCss(bad));assert.equal(validateAndNormalizeTheme(bad).ok,false);
  await assert.rejects(compile('.x { @ds-surface(contained); }',{theme:bad}));
 }
 await assert.rejects(compile('.x { @ds-surface(missing); }'));
 assert.throws(()=>surfaceDeclarations(theme,'contained','primary','99'));
});
test('input/button base consumers still compile and local overrides remain ordered',async()=>{
 const result=await compile('.input { @ds-input(outlined primary 2); } .button { @ds-button(contained primary 2); } .card { @ds-surface(contained); box-shadow: none; }',{theme});
 assert(!result.css.includes('@ds-'));
 const card=[];postcss.parse(result.css).walkRules('.card',r=>r.walkDecls('box-shadow',d=>card.push(d.value)));
 assert.deepEqual(card,['var(--surface-contained-shadow)','none']);
 assert(result.css.includes('var(--surface-contained-padding)')||result.css.includes('var(--density-2)'));
});

test('Surface backgrounds preserve native gradients and palette opacity',()=>{
 const css=generateSurfaceCss({surfaces:{contained:{bg:'linear-gradient(palette(primary.main, 0.5), transparent)'}}});
 assert(css.includes('linear-gradient(color-mix(in srgb, var(--ds__palette__primary-main) 50%, transparent), transparent)'));
});

test('legacy tone-only invocation uses a configured palette family',async()=>{
 const output=await compile('.x { @ds-surface(light, 2); }',{theme:withBaseline({palette:{...BASE_PALETTE,light:{main:'white',contrast:'black'}}})});
 assert(output.css.includes('background: var(--ds__palette__light-main)'));
 assert(output.css.includes('padding: var(--density-2)'));
});
