const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const postcss=require('postcss');const plugin=require('../dist/plugin');
const {generateThemeCss}=require('../dist/ds-runtime/theme-generator');
const {getDensityTokens,compileDensityRules,DEFAULT_DENSITIES,responsiveEntries}=require('../dist/language');
const {surfaceValueToCss}=require('../dist/surfaces');const {presetValueToCss}=require('../dist/preset-engine');
const {validateTheme}=require('../dist/ds-runtime/theme-validate');
const compile=(source,theme={})=>postcss([plugin({theme})]).process(source,{from:undefined});
function variables(css){const result={};postcss.parse(css).walkDecls(/^--/,d=>{let parent=d.parent;const path=[];while(parent.type!=='root'){path.unshift(parent.type==='atrule'?`@${parent.name} ${parent.params}`:parent.selector);parent=parent.parent}result[path.join('/')+'/'+d.prop]=d.value});return result;}
// Full 1-16 spacing (this file's own 1/2/3 win) plus the palette families
// (surface/neutral/error, alongside this file's own primary) the always-on
// density/surface/button/input defaults need, so strict reference
// validation (every :root block the plugin always emits, not just what
// this file's source uses) passes. See
// docs/features/FEAT-002-beta-migration-hardening.md.
const FULL_SPACING=Object.fromEntries(Array.from({length:16},(_,i)=>[i+1,`${(i+1)*4}px`]));
const theme={colors:{blue:{500:'#123456'},white:'#fff'},palette:{primary:{main:'var(--uxdsl__color__blue-500)',contrast:'var(--uxdsl__color__white)',dark:'#111'},surface:{main:'#fff',dark:'#eee',contrast:'#000'},neutral:{main:'#999',dark:'#333'},error:{main:'#f00'}},spacing:{...FULL_SPACING,1:'2px',2:'4px',3:'8px',gutter:'16px'},densities:{2:'xs(space(1)) md(space(3))'},breakpoints:{md:800},modes:{dark:{palette:{primary:{main:'#654321'}}}},surfaces:{card:{padding:'density(2)'}},buttons:{action:{surface:'card',states:{hover:{bg:'palette(primary)'}}}},inputs:{field:{surface:'card',base:{caret:'palette(primary)'}}}};
test('all generated theme variables and mode selectors agree across build and runtime',async()=>{
 assert.deepEqual(variables((await compile('',theme)).css),variables(generateThemeCss(theme)));
});
test('Density tokens come from the JSON and no configuration leaks between builds',async()=>{
 const first=await compile('',{spacing:FULL_SPACING,palette:theme.palette,colors:theme.colors,densities:{custom:'xs(space(3))'}});
 assert(first.css.includes('--uxdsl__density__custom: var(--uxdsl__space__3)'));
 const baseline={spacing:FULL_SPACING,palette:theme.palette,colors:theme.colors};
 const second=(await compile('',baseline)).css;assert(!second.includes('--uxdsl__density__custom:'));
 assert.deepEqual(variables(second),variables(generateThemeCss(baseline)));
});
test('a JSON density for a built-in key replaces DEFAULT_DENSITIES; a @theme pack is an error, not a second source',async()=>{
 const explicitWins=await compile('',{spacing:FULL_SPACING,palette:theme.palette,colors:theme.colors,densities:{4:'xs(space(9))'}});
 assert(explicitWins.css.includes('--uxdsl__density__4: var(--uxdsl__space__9)'));
 assert(!explicitWins.css.includes(`--uxdsl__density__4: ${DEFAULT_DENSITIES['4']}`.replace(/space\((\d+)\)/g,'var(--uxdsl__space__$1)')));
 await assert.rejects(()=>compile('@theme { density-4: xs(space(1)) md(space(2)); }',{spacing:FULL_SPACING,palette:theme.palette,colors:theme.colors}),/UXD_THEME_BLOCK_REMOVED/);
});
test('simple values, named spacing and alpha have one meaning in direct CSS and presets',async()=>{
 for(const expression of ['color(white)','palette(primary)','space(gutter)','palette(primary.main, 0.25)','color(blue.500, 0.125)','color(display-p3 1 0 0)']){
  const css=(await compile(`.x { color: ${expression}; }`,theme)).css;let actual;postcss.parse(css).walkRules('.x',r=>r.walkDecls(d=>actual=d.value));
  assert.equal(actual,presetValueToCss(expression),expression);assert.equal(actual,surfaceValueToCss(expression,theme),expression);
 }
 for(const expression of ['palette(primary, 2)','color(blue, invalid)','density(0.5)'])await assert.rejects(()=>compile(`.x { color: ${expression}; }`));
});
test('Density validation is consistent between generation, validation and PostCSS',async()=>{
 for(const densities of [null,{bad:'md(space(1))'},{bad:'xs(space(1)) tablet(space(2))'},{bad:'xs(space(1)'},{bad:''}]){
  assert.throws(()=>generateThemeCss({densities}));assert.equal(validateTheme({densities}).ok,false);await assert.rejects(()=>compile('',{densities}));
 }
 assert.throws(()=>compileDensityRules({}, {xs:0,sm:0}));
});
test('shared Density defaults refer only to shipped spacing and display parsing handles nested CSS',()=>{
 const spacing=require('../dist/default-theme').DEFAULT_THEME.spacing;
 for(const expression of Object.values(DEFAULT_DENSITIES))for(const [,key] of expression.matchAll(/space\((\d+)\)/g))assert(Object.prototype.hasOwnProperty.call(spacing,key),key);
 assert.deepEqual(responsiveEntries('xs(calc(space(1) + 2px)) wide(clamp(2px, 1vw, 8px))',{xs:0,wide:900}),{xs:'calc(space(1) + 2px)',wide:'clamp(2px, 1vw, 8px)'});
 assert.equal(getDensityTokens({densities:{custom:'4px'}}).custom,'4px');
});
test('applyTheme writes a standalone Color under the same key as the compiler',()=>{
 const runtime=require('./helpers/ds-runtime');const byId=new Map();const previousDocument=global.document;
 global.document={createElement:()=>({id:'',textContent:'',setAttribute(){},getAttribute(){return null}}),getElementById:id=>byId.get(id)||null,head:{appendChild(node){if(node.id)byId.set(node.id,node);return node}}};
 try{const applied=runtime.applyTheme({colors:{white:'#abcdef'}},{replace:true});assert.equal(applied.ok,true,applied.ok?'':applied.error.message);
  const css=byId.get(runtime.DEFAULT_THEME_STYLE_ID).textContent;assert.match(css,/--uxdsl__color__white:\s*#abcdef/);assert.doesNotMatch(css,/--uxdsl__color__white-main/)}
 finally{if(previousDocument===undefined)delete global.document;else global.document=previousDocument}
});
test('literal CSS string whitespace is not altered by token resolution',async()=>{
 const css=(await compile('.x { content: "two  spaces"; }',{spacing:FULL_SPACING,palette:theme.palette,colors:theme.colors})).css;assert(css.includes('"two  spaces"'));
});
test('component responsive shorthand preserves independent groups and future-only overrides',async()=>{
 const css=(await compile('.x { padding: xs(1px) md(2px) xs(3px) md(4px); margin: md(5px); }',{spacing:FULL_SPACING,palette:theme.palette,colors:theme.colors})).css;
 const records=[];postcss.parse(css).walkRules('.x',r=>r.walkDecls(d=>records.push([r.parent.type==='atrule'?r.parent.params:'base',d.prop,d.value])));
 assert(records.some(([where,key,value])=>where==='base'&&key==='padding'&&value==='1px 3px'));
 assert(records.some(([where,key,value])=>where==='(min-width: 768px)'&&key==='padding'&&value==='2px 4px'));
 assert(!records.some(([where,key])=>where==='base'&&key==='margin'));
 assert(records.some(([where,key,value])=>where==='(min-width: 768px)'&&key==='margin'&&value==='5px'));
});
