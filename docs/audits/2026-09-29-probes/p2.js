const postcss=require('/Users/ricardosantoyo/Documents/projects/uxdsl/packages/postcss-uxdsl/node_modules/postcss');const ux=require('/Users/ricardosantoyo/Documents/projects/uxdsl/packages/postcss-uxdsl/dist/index.js');
const run=async(k,css,opts={includeTheme:false})=>{try{const r=await postcss([ux(opts)]).process(css,{from:'p.uxdsl'});console.log('### '+k+'\n'+r.css.trim().slice(0,600)+'\n');r.warnings().forEach(w=>console.log('  WARN',w.text));return r.css}catch(e){console.log('### '+k+'\n  ERR '+(e.code||'')+' '+e.message.split('\n')[0]+'\n')}};
(async()=>{
 await run('space0','.a{padding: space(0);}');
 await run('space17','.a{padding: space(17);}');
 await run('density0','.a{padding: density(0);}');
 await run('unknownFn','.a{color: foo(bar); width: fit-content; background: linear-gradient(red, blue);}');
 await run('varFallback','.a{padding: var(--x, xs(1rem) md(2rem));}');
 await run('customBp','.a{padding: xs(1rem) tablet(2rem);}',{includeTheme:false,theme:{breakpoints:{tablet:600}}});
 await run('customBpOnly','.a{padding: xs(1rem) md(2rem);}',{includeTheme:false,theme:{breakpoints:{xs:0,tablet:600}}});
 const full=await run('fullTheme','.a{padding: density(2);}',{includeTheme:true});
 if(full){const props=(full.match(/--uxdsl__[a-z]+__/g)||[]);const fam={};props.forEach(p=>fam[p]=(fam[p]||0)+1);console.log('bytes',full.length,'custom props',props.length,JSON.stringify(fam));console.log('media blocks',(full.match(/@media/g)||[]).length);const dark=full.indexOf('dark');console.log('dark applied via:',full.slice(full.search(/prefers-color-scheme|data-theme|\.dark|\[data/),full.search(/prefers-color-scheme|data-theme|\.dark|\[data/)+80));}
 await run('themeNumber','.a{color: palette(primary.main); padding: space(1);}',{includeTheme:true,theme:{palette:{primary:{main:5}},spacing:{1:{}}}}).then(c=>c&&console.log('emits:',/primary-main: 5;/.test(c),/\[object Object\]/.test(c)));
 await run('darkNull','.a{color: palette(primary.main);}',{includeTheme:true,theme:{modes:{dark:null}}}).then(c=>c&&console.log('has dark:',/prefers-color-scheme|data-theme/.test(c)));
})();
