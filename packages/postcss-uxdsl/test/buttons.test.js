const {test}=require('node:test');
const assert=require('node:assert/strict');
const postcss=require('postcss');
const exported=require('../dist/index');
const plugin=exported.default||exported;
const {generateButtonCss,getButtonTokens,buttonDeclarations,buttonComponentCss,inspectButtonTheme,parseButtonArguments}=require('../dist/buttons');
const {generateThemeCss}=require('../dist/ds-runtime/theme-generator');
// Full 1-16 spacing plus the palette families the always-on density/surface/
// button/input defaults need, so strict reference validation (every :root
// block the plugin always emits, not just what this file's source uses)
// passes. See docs/features/FEAT-002-beta-migration-hardening.md.
const FULL_SPACING=Object.fromEntries(Array.from({length:16},(_,i)=>[i+1,`${(i+1)*4}px`]));
const BASE_PALETTE={primary:{main:'#123',dark:'#111',contrast:'#fff'},surface:{main:'#fff',dark:'#eee',contrast:'#000'},neutral:{main:'#999',dark:'#333'},error:{main:'#f00'}};
const withBaseline=(extra={})=>({spacing:FULL_SPACING,palette:BASE_PALETTE,...extra});
const theme={breakpoints:{xs:0,md:800},spacing:FULL_SPACING,palette:{...BASE_PALETTE,'brand-blue':{main:'blue',dark:'navy',contrast:'white'}},buttons:{checkout:{surface:'outlined',base:{padding:'xs(8px) md(16px)'},states:{selected:{shadow:'xs(shadow(1)) md(shadow(3))'},focusvisible:{outline:'2px solid blue'}}}}};
const compile=(source,theme={})=>postcss([plugin({theme})]).process(source,{from:undefined});
function vars(css){const out=[];postcss.parse(css).walkDecls(/^--button-/,d=>{if(d.parent.selector===':root')out.push([d.parent.parent.type==='atrule'?d.parent.parent.params:'base',d.prop,d.value])});return out;}
test('Buttons PostCSS/runtime share custom base and responsive state variables',async()=>{
 const result=await compile('.x { @ds-button(checkout); }',theme);
 assert.deepEqual(vars(result.css),vars(generateThemeCss(theme)));
 assert(result.css.includes('var(--button-checkout-base-padding)'));
 assert(result.css.includes('var(--button-checkout-selected-shadow)'));
 for(const [width,value] of [[799,'8px'],[800,'16px'],[801,'16px'],[1400,'16px']])assert.equal(inspectButtonTheme(theme,width)['--button-checkout-base-padding'],value);
});
test('Button tone, size, state selectors and component CSS use shared composition',async()=>{
 const t={...theme,buttons:{checkout:{surface:'outlined'}}};
 const actual=(await compile('.x { @ds-button(checkout brand-blue 2); }',t)).css;
 const expected=buttonDeclarations(t,'checkout','brand-blue','2');
 const base={};postcss.parse(actual).walkRules('.x',r=>r.walkDecls(d=>base[d.prop]=d.value));assert.deepEqual(base,expected.base);
 assert.equal(base['--button-tone-dark'],'var(--ds__palette__brand-blue-dark)');
 assert.equal(base.padding,'var(--density-2)');
 assert(actual.includes('[aria-pressed="true"]'));
 assert(buttonComponentCss(t,'.a, .b','checkout').includes('.a:hover, .b:hover'));
});
test('legacy button packs, JSON precedence and compilation isolation',async()=>{
 const legacy='@theme { button-checkout: { @ds-surface(outlined); padding: 7px; :hover { bg: red; } } } .x { @ds-button(checkout); }';
 const css=(await compile(legacy,withBaseline({buttons:{checkout:{base:{padding:'9px'},states:{hover:{color:'white'}}}}}))).css;
 assert(css.includes('--button-checkout-base-padding: 9px'));
 assert(css.includes('--button-checkout-hover-bg: red'));
 assert(css.includes('--button-checkout-hover-color: white'));
 assert(css.includes('var(--surface-outlined-radius)'));
 await assert.rejects(()=>compile('.x { @ds-button(checkout); }'),/UXD_BUTTON/);
});
test('invalid Button roles, fields, states and mappings fail in both paths',async()=>{
 for(const buttons of [null,{x:null},{x:{unknown:'red'}},{x:{surface:'missing'}},{x:{base:null}},{x:{states:null}},{x:{states:{hover:null}}},{x:{states:{unknown:{color:'red'}}}},{x:{base:{padding:'md(8px)'}}}]){
  assert.throws(()=>generateButtonCss({buttons}));await assert.rejects(()=>compile('.x { @ds-button(contained); }',{buttons}));
 }
 assert.throws(()=>parseButtonArguments({},'(invented)'));
 assert.throws(()=>parseButtonArguments({},'(contained density(2))'));
});
test('Button defaults are immutable across theme reads and state CSS retains local override order',async()=>{
 const a=getButtonTokens({});a.contained.states.hover.bg='red';assert.notEqual(getButtonTokens({}).contained.states.hover.bg,'red');
 const css=(await compile('.x { @ds-button(contained); padding: 3px; }',withBaseline())).css;
 assert(css.indexOf('padding: 3px')>css.indexOf('padding: var(--surface-contained-padding)'));
 assert(css.includes('box-shadow: var(--surface-contained-shadow)'));
});
test('toned state variables resolve at theme scope and preserve explicit assignments',()=>{
 const t={palette:{'brand-blue':{main:'blue',dark:'navy',contrast:'white'}},buttons:{contained:{states:{selected:{color:'red'}}}}};
 const values=inspectButtonTheme(t,0);
 assert.equal(values['--button-contained-tone-brand-blue-hover-bg'],'var(--ds__palette__brand-blue-dark)');
 assert.equal(values['--button-contained-tone-brand-blue-selected-color'],'red');
 assert(buttonDeclarations(t,'contained','brand-blue').states.hover.background.includes('--button-contained-tone-brand-blue-hover-bg'));
});
