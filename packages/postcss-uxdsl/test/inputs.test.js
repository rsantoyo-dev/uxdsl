const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const postcss=require('postcss');
const exported=require('../dist/index');
const plugin=exported.default||exported;
const {generateInputCss,getInputTokens,inputDeclarations,inputComponentCss,inspectInputTheme,parseInputArguments}=require('../dist/inputs');
const {generateThemeCss}=require('../dist/ds-runtime/theme-generator');
const {validateAndNormalizeTheme}=require('../dist/ds-runtime/theme-validate');
const theme={breakpoints:{xs:0,md:800},palette:{'brand-blue':{main:'blue',dark:'navy',contrast:'white'}},inputs:{search:{surface:'outlined',base:{padding:'xs(8px) md(16px)',placeholder:'gray'},states:{focus:{shadow:'xs(shadow(1)) md(shadow(3))',placeholder:'black'},focusvisible:{outline:'2px solid blue'},readonly:{bg:'silver'}}}}};
const compile=(source,theme={})=>postcss([plugin({theme})]).process(source,{from:undefined});
function vars(css){const out=[];postcss.parse(css).walkDecls(/^--input-/,d=>{if(d.parent.selector===':root')out.push([d.parent.parent.type==='atrule'?d.parent.parent.params:'base',d.prop,d.value])});return out;}
test('Input PostCSS and runtime share custom roles, fields and responsive variables',async()=>{
 const css=(await compile('.x { @ds-input(search); }',theme)).css;
 assert.deepEqual(vars(css),vars(generateThemeCss(theme)));
 for(const [width,value] of [[799,'8px'],[800,'16px'],[801,'16px'],[1400,'16px']])assert.equal(inspectInputTheme(theme,width)['--input-search-base-padding'],value);
 assert(css.includes('var(--input-search-focus-shadow)'));
 assert(css.includes('var(--surface-outlined-radius)'));
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
 assert.equal(inspectInputTheme(t,0)['--input-search-tone-brand-blue-base-caret'],'var(--ds__palette__brand-blue-main)');
 assert.equal(inspectInputTheme(t,0)['--input-search-tone-brand-blue-invalid-border'],'1px solid var(--ds__palette__error-main)');
});
test('Input legacy packs merge JSON fields and do not leak into another compilation',async()=>{
 const source='@theme { input-search: { @ds-surface(outlined); padding: 7px; :focus { bg: red; placeholder: gray; } } } .x { @ds-input(search); }';
 const css=(await compile(source,{inputs:{search:{base:{padding:'9px'},states:{focus:{color:'white'}}}}})).css;
 for(const text of ['--input-search-base-padding: 9px','--input-search-focus-bg: red','--input-search-focus-color: white','var(--surface-outlined-radius)'])assert(css.includes(text));
 await assert.rejects(()=>compile('.x { @ds-input(search); }'),/UXD_INPUT/);
});
test('generated legacy Input defaults match engine defaults',async()=>{
 const source=fs.readFileSync(require.resolve('../src/theme/default-inputs.uxdsl'),'utf8');
 assert.deepEqual(vars((await compile(source)).css),vars(generateInputCss({})));
});
test('underline maps to bottom border and preserves local CSS ordering',async()=>{
 const css=(await compile('.x { @ds-input(underline); border-bottom-width: 3px; }')).css;
 const base={};postcss.parse(css).walkRules('.x',r=>r.walkDecls(d=>base[d.prop]=d.value));
 assert.equal(base.border,'var(--input-underline-base-border)');assert.equal(base['border-bottom'],'var(--input-underline-base-underline)');
 assert.equal(base['border-bottom-width'],'3px');
 const values=inspectInputTheme({},0);assert.equal(values['--input-underline-base-border'],'none');assert.equal(values['--input-underline-base-shadow'],'none');
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
