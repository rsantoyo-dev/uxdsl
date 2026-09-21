const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const postcss=require('postcss');
const exported=require('../dist/index');
const plugin=exported.default||exported;
const {generateInputCss,getInputTokens,inputDeclarations,inputComponentCss,inspectInputTheme,parseInputArguments}=require('../dist/inputs');
const {generateThemeCss}=require('../dist/ds-runtime/theme-generator');
const {resolveTheme}=require('../dist/default-theme');
const {validateAndNormalizeTheme}=require('../dist/ds-runtime/theme-validate');
// Full 1-16 spacing plus the palette families the always-on density/surface/
// button/input defaults need, so strict reference validation (every :root
// block the plugin always emits, not just what this file's source uses)
// passes. See docs/features/FEAT-002-beta-migration-hardening.md.
const FULL_SPACING=Object.fromEntries(Array.from({length:16},(_,i)=>[i+1,`${(i+1)*4}px`]));
const BASE_PALETTE={primary:{main:'#123',dark:'#111',contrast:'#fff'},surface:{main:'#fff',dark:'#eee',contrast:'#000'},neutral:{main:'#999',dark:'#333'},error:{main:'#f00'}};
const withBaseline=(extra={})=>({spacing:FULL_SPACING,palette:BASE_PALETTE,...extra});
const theme={breakpoints:{xs:0,md:800},spacing:FULL_SPACING,palette:{...BASE_PALETTE,'brand-blue':{main:'blue',dark:'navy',contrast:'white'}},inputs:{search:{surface:'outlined',base:{padding:'xs(8px) md(16px)',placeholder:'gray'},states:{focus:{shadow:'xs(shadow(1)) md(shadow(3))',placeholder:'black'},focusvisible:{outline:'2px solid blue'},readonly:{bg:'silver'}}}}};
const compile=(source,theme={})=>postcss([plugin({theme})]).process(source,{from:undefined});
function vars(css){const out=[];postcss.parse(css).walkDecls(/^--uxdsl__input__/,d=>{if(d.parent.selector===':root')out.push([d.parent.parent.type==='atrule'?d.parent.parent.params:'base',d.prop,d.value])});return out;}
test('Input PostCSS and runtime share custom roles, fields and responsive variables',async()=>{
 const css=(await compile('.x { @ds-input(search); }',theme)).css;
 assert.deepEqual(vars(css),vars(generateThemeCss(theme)));
 for(const [width,value] of [[799,'8px'],[800,'16px'],[801,'16px'],[1400,'16px']])assert.equal(inspectInputTheme(theme,width)['--uxdsl__input__search-base-padding'],value);
 assert(css.includes('var(--uxdsl__input__search-focus-shadow)'));
 assert(css.includes('var(--uxdsl__surface__outlined-radius)'));
});
test('Input placeholder states and selector lists produce valid pseudo-element CSS',async()=>{
 const css=(await compile('.x, .y { @ds-input(search); }',theme)).css;
 for(const selector of ['.x::placeholder, .y::placeholder','.x:focus::placeholder, .y:focus::placeholder','.x:read-only, .y:read-only'])assert(css.includes(selector));
 const invalid=[];postcss.parse(css).walkDecls(d=>{if(['bg','caret','placeholder','shadow','underline','radius'].includes(d.prop))invalid.push(d.prop)});assert.deepEqual(invalid,[]);
});
test('Input tone, size, base precedence and native defaults match both adapters',async()=>{
 const t={...theme,inputs:{search:{surface:'outlined'}}};
 const css=(await compile('.x { @ds-input(search brand-blue 2); width: auto; }',t)).css;
 const {placeholder,...expected}=inputDeclarations(t,'search','brand-blue','2').base;
 const actual={};postcss.parse(css).walkRules('.x',r=>r.walkDecls(d=>actual[d.prop]=d.value));assert.deepEqual(actual,{...expected,width:'auto'});
 assert.equal(expected.font,'inherit');assert(!('outline' in expected));assert(!('appearance' in expected));
 assert.equal(inspectInputTheme(t,0)['--uxdsl__input__search-tone-brand-blue-base-caret'],'var(--uxdsl__palette__brand-blue-main)');
 assert.equal(inspectInputTheme(t,0)['--uxdsl__input__search-tone-brand-blue-invalid-border'],'1px solid var(--uxdsl__palette__error-main)');
});
test('Input legacy packs merge JSON fields and do not leak into another compilation',async()=>{
 const source='@theme { input-search: { @ds-surface(outlined); padding: 7px; :focus { bg: red; placeholder: gray; } } } .x { @ds-input(search); }';
 const css=(await compile(source,withBaseline({inputs:{search:{base:{padding:'9px'},states:{focus:{color:'white'}}}}}))).css;
 for(const text of ['--uxdsl__input__search-base-padding: 9px','--uxdsl__input__search-focus-bg: red','--uxdsl__input__search-focus-color: white','var(--uxdsl__surface__outlined-radius)'])assert(css.includes(text));
 await assert.rejects(()=>compile('.x { @ds-input(search); }'),/UXD_INPUT/);
});
test('generated legacy Input defaults match engine defaults',async()=>{
 const source=fs.readFileSync(require.resolve('../src/theme/default-inputs.uxdsl'),'utf8');
 // MIG-B6-29: compile() resolves withBaseline() against the now much
 // larger DEFAULT_THEME.palette (14 families, not 4) before generating
 // tone variables; a bare generateInputCss(withBaseline()) call bypasses
 // that resolution and only ever sees withBaseline()'s own 4 families, so
 // the two sides must both go through resolveTheme() to compare the same
 // effective tone set instead of two different ones that happened to
 // coincide back when DEFAULT_THEME.palette itself only had 4 families.
 assert.deepEqual(vars((await compile(source,withBaseline())).css),vars(generateInputCss(resolveTheme(withBaseline()))));
});
test('underline maps to bottom border and preserves local CSS ordering',async()=>{
 const css=(await compile('.x { @ds-input(underline); border-bottom-width: 3px; }',withBaseline())).css;
 const base={};postcss.parse(css).walkRules('.x',r=>r.walkDecls(d=>base[d.prop]=d.value));
 assert.equal(base.border,'var(--uxdsl__input__underline-base-border)');assert.equal(base['border-bottom'],'var(--uxdsl__input__underline-base-underline)');
 assert.equal(base['border-bottom-width'],'3px');
 const values=inspectInputTheme({},0);assert.equal(values['--uxdsl__input__underline-base-border'],'none');assert.equal(values['--uxdsl__input__underline-base-shadow'],'none');
});
test('invalid Input configuration fails before CSS emission in runtime and PostCSS',async()=>{
 for(const inputs of [null,{x:null},{x:{extra:'red'}},{x:{surface:'missing'}},{x:{base:null}},{x:{states:null}},{x:{states:{focus:null}}},{x:{states:{selected:{color:'red'}}}},{x:{base:{padding:'md(8px)'}}}]){
  assert.throws(()=>generateInputCss({inputs}));await assert.rejects(()=>compile('.x { @ds-input(contained); }',{inputs}));
  assert.equal(validateAndNormalizeTheme({inputs}).ok,false);
 }
 assert.throws(()=>parseInputArguments({},'(invented)'));
 assert.throws(()=>parseInputArguments({},'(contained density(2))'));
});
test('Input inspection and custom modifications do not mutate shared defaults',()=>{
 const a=getInputTokens({});a.contained.states.focus.border='red';assert.notEqual(getInputTokens({}).contained.states.focus.border,'red');
 assert.throws(()=>inspectInputTheme({},-1));
 assert(inputComponentCss(theme,'.x','search').includes('.x:focus-visible'));
});
