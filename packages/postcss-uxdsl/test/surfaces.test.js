const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const exported = require('../dist/index');
const plugin = exported.default || exported;
const { generateSurfaceCss, inspectSurfaceTheme, surfaceDeclarations, getSurfaceTokens } = require('../dist/surfaces');
const { generateThemeCss } = require('../dist/ds-runtime/theme-generator');
const { validateTheme } = require('../dist/ds-runtime/theme-validate');
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
 const result=[];postcss.parse(css).walkDecls(/^--uxdsl__surface__/,d=>result.push([d.parent.parent.type==='atrule'?d.parent.parent.params:'base',d.prop,d.value]));return result;
}
test('Surface variables match build/runtime output and preserve composition references',async()=>{
 const result=await compile('.card { @ds-surface(contained); } .notice { @ds-surface(notice); }',{theme});
 assert.deepEqual(declarations(result.css),declarations(generateThemeCss(theme)));
 assert(result.css.includes('border-radius: var(--uxdsl__surface__contained-radius)'));
 assert(result.css.includes('--uxdsl__surface__contained-radius: var(--uxdsl__radius__2)'));
 assert(result.css.includes('var(--uxdsl__surface__notice-padding)'));
});
test('Surface inspector preserves responsive boundaries and missing-field inheritance',()=>{
 assert.equal(getSurfaceTokens(theme).notice.radius,'radius(2)');
 for(const [width,shadow] of [[799,'var(--uxdsl__shadow__1)'],[800,'var(--uxdsl__shadow__3)'],[801,'var(--uxdsl__shadow__3)'],[1400,'var(--uxdsl__shadow__3)']]) assert.equal(inspectSurfaceTheme(theme,width)['--uxdsl__surface__contained-shadow'],shadow);
 assert.equal(inspectSurfaceTheme(theme,0)['--uxdsl__surface__notice-padding'],'12px');
});
test('tone and size composition matches compiled declarations',async()=>{
 for(const role of ['contained','outlined','flat','notice']) {
  const expected=surfaceDeclarations(theme,role,'primary','2');
  const css=(await compile(`.x { @ds-surface(${role} primary 2); }`,{theme})).css;
  const actual={};postcss.parse(css).walkRules('.x',r=>r.walkDecls(d=>actual[d.prop]=d.value));assert.deepEqual(actual,expected);
 }
 const hyphen=(await compile('.x { @ds-surface(contained brand-blue); }',{theme})).css; assert(hyphen.includes('var(--uxdsl__palette__brand-blue-main)'));
 assert.equal(surfaceDeclarations(theme,'outlined','primary').border,'1px solid var(--uxdsl__palette__primary-main)');
 assert.equal(surfaceDeclarations(theme,'flat','primary').border,'var(--uxdsl__surface__flat-border)');
});
test('Surface definitions come from the JSON through the shared rules; a @theme pack fails; no leakage',async()=>{
 const source='.x { @ds-surface(contained); }';
 const custom=withBaseline({surfaces:{contained:{bg:'pink',padding:'11px'}}});
 const output=await compile(source,{theme:custom});
 assert(output.css.includes('--uxdsl__surface__contained-bg: pink'));
 assert(output.css.includes('--uxdsl__surface__contained-padding: 11px'));
 assert(!(await compile(source,{theme:withBaseline()})).css.includes('11px'));
 assert.deepEqual(declarations(output.css),declarations(generateSurfaceCss(custom)));
 await assert.rejects(()=>compile('@theme { surface-contained: { bg: pink; padding: 11px; } } '+source,{theme:withBaseline()}),/UXD_THEME_BLOCK_REMOVED/);
});
test('invalid Surface roles, fields, references and expressions are rejected',async()=>{
 for(const bad of [{surfaces:{contained:null}},{surfaces:[]},{surfaces:{contained:{unknown:'1px'}}},{surfaces:{contained:{shadow:'md(shadow(1))'}}},{surfaces:{contained:{radius:'radius(99)'}}},{surfaces:{contained:{bg:''}}}]) {
  assert.throws(()=>generateSurfaceCss(bad));assert.equal(validateTheme(bad).ok,false);
  await assert.rejects(compile('.x { @ds-surface(contained); }',{theme:bad}));
 }
 await assert.rejects(compile('.x { @ds-surface(missing); }'));
 assert.throws(()=>surfaceDeclarations(theme,'contained','primary','99'));
});
test('input/button base consumers still compile and local overrides remain ordered',async()=>{
 const result=await compile('.input { @ds-input(outlined primary 2); } .button { @ds-button(contained primary 2); } .card { @ds-surface(contained); box-shadow: none; }',{theme});
 assert(!result.css.includes('@ds-'));
 const card=[];postcss.parse(result.css).walkRules('.card',r=>r.walkDecls('box-shadow',d=>card.push(d.value)));
 assert.deepEqual(card,['var(--uxdsl__surface__contained-shadow)','none']);
 assert(result.css.includes('var(--uxdsl__surface__contained-padding)')||result.css.includes('var(--uxdsl__density__2)'));
});

test('Surface backgrounds preserve native gradients and palette opacity',()=>{
 const css=generateSurfaceCss({surfaces:{contained:{bg:'linear-gradient(palette(primary.main, 0.5), transparent)'}}});
 assert(css.includes('linear-gradient(color-mix(in srgb, var(--uxdsl__palette__primary-main) 50%, transparent), transparent)'));
});

test('a tone is a Palette family with main, dark and contrast, named after the role',async()=>{
 const theme=withBaseline({palette:{...BASE_PALETTE,light:{main:'white',dark:'gray',contrast:'black'}}});
 const output=await compile('.x { @ds-surface(contained light 2); }',{theme});
 assert(output.css.includes('background: var(--uxdsl__palette__light-main)'));
 assert(output.css.includes('padding: var(--uxdsl__density__2)'));
 // The former tone-only and comma-separated forms name the grammar instead of guessing a role.
 await assert.rejects(()=>compile('.x { @ds-surface(light 2); }',{theme}),/UXD_SURFACE_REFERENCE: "light" is a tone, not a role; the role comes first/);
 await assert.rejects(()=>compile('.x { @ds-surface(contained, light); }',{theme}),/UXD_SURFACE_ARGUMENT/);
});
