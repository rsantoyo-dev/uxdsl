// The 2026-10-09 experiment behind decision D-1 of docs/audits/2026-10-08-plan-beta9.md:
// real Dart Sass inside UXDSL's pipeline, with a pass that protects UXDSL's own syntax.
// Needs packages/uxdsl built and Dart Sass installed at the repository root (npm i --no-save sass).
// Run: node docs/audits/2026-10-09-sass-layer/run.js
const fs=require('fs');
const path=require('path');
const R=process.env.UXDSL_REPO || path.resolve(__dirname,'../../..');
process.chdir(__dirname);
const sass=require(R+'/node_modules/sass');
const postcss=require(R+'/packages/uxdsl/node_modules/postcss');
const uxdsl=require(R+'/packages/uxdsl/dist/plugin.js');
const src=fs.readFileSync('input.uxdsl','utf8');
console.log('=== 1. Real Sass directly');
try{ sass.compileString(src,{style:'expanded'}); console.log('compiled'); }catch(e){ console.log('ERROR:', e.message.split('\n')[0]); }
// 2. protect UXDSL syntax, Sass, restore, UXDSL
const protect=(s)=>s
  .replace(/\b(palette|color)\(\s*([a-z][a-z0-9-]*\.[a-z0-9-]+)\s*(,[^)]*)?\)/g,(m,fn,key,rest)=>`uxdsl-${fn}("${key}"${rest||''})`)
  .replace(/(@ds-[a-z]+\s*\()([^)]*)\)/g,(m,head,args)=>head+args.replace(/(^|[^{])\$([a-zA-Z_][\w-]*)/g,(mm,pre,name)=>`${pre}#{$${name}}`)+')');
const restore=(s)=>s.replace(/@(ds-[a-z]+) \(/g,"@$1(").replace(/uxdsl-(palette|color)\("([^"]*)"(,[^)]*)?\)/g,(m,fn,key,rest)=>`${fn}(${key}${rest||''})`);
console.log('\n=== 2. protect → Sass → restore → UXDSL');
let afterSass;
try{ afterSass=sass.compileString(protect(src),{style:'expanded'}).css; }catch(e){ console.log('SASS ERROR:', e.message.split('\n')[0]); process.exit(0); }
const restored=restore(afterSass);
fs.writeFileSync('after-sass.css',restored);
postcss([uxdsl({discoverTheme:false,includeTheme:false})]).process(restored,{from:'input.uxdsl'}).then(r=>{
  fs.writeFileSync('out.css',r.css);
  console.log(r.css.replace(/\n\s*\n/g,'\n'));
}).catch(e=>console.log('UXDSL ERROR:', e.message.split('\n')[0]));
