const postcss=require('/Users/ricardosantoyo/Documents/projects/uxdsl/packages/postcss-uxdsl/node_modules/postcss');const ux=require('/Users/ricardosantoyo/Documents/projects/uxdsl/packages/postcss-uxdsl/dist/index.js');
const cases={
 base:'.a{padding: xs(1rem) md(2rem);}',
 noBase:'.a{padding: md(2rem);}',
 order:'.a{padding: md(2rem) xs(1rem);}',
 shorthand:'.a{margin: xs(1px 2px) md(3px 4px) !important;}',
 calc:'.a{width: calc(100% - xs(1rem) md(2rem));}',
 customProp:'.a{--gap: xs(1rem) md(2rem); gap: var(--gap);}',
 nestedHover:'.a{ &:hover{ padding: xs(1rem) md(2rem);} }',
 nestedChild:'.a{ .b{ color: palette(primary.main); padding: density(2);} }',
 inMedia:'@media (prefers-reduced-motion){ .a{ padding: xs(1rem) md(2rem);} }',
 dupDirective:'.a{ @ds-surface(contained); padding: density(4); background: red;}',
 twoDirectives:'.a{ @ds-surface(contained); @ds-typo(h1); }',
 paletteForms:'.a{ color: palette(primary.main); background: palette(primary-main); border-color: palette(primary.main, 0.5); outline-color: palette(primary);}',
 colorForms:'.a{ color: color(gray.300); background: color(gray-300); border-color: color(white, 0.5); outline-color: color(gray);}',
 spaceForms:'.a{ padding: space(4) space(4.5) space(0) space(17);}',
 borderArgs:'.a{ border: border(1, red, dashed); border-radius: radius(pill) rounded(2); box-shadow: elevation(2);}',
 keyframes:'@keyframes k{ from{ padding: xs(1rem) md(2rem);} }',
 unknownFn:'.a{ color: foo(bar); width: xxl(3px);}',
 typoUnknown:'.a{ @ds-typo(nope); }',
 directiveSpace:'.a{ @ds-surface (contained); }',
 directiveNoParen:'.a{ @ds-surface contained; }',
};
(async()=>{for(const [k,css] of Object.entries(cases)){try{const r=await postcss([ux({includeTheme:false})]).process(css,{from:'p.uxdsl'});console.log('### '+k+'\n'+r.css.trim()+'\n');r.warnings().forEach(w=>console.log('  WARN',w.text));}catch(e){console.log('### '+k+'\n  ERR '+(e.code||'')+' '+e.message.split('\n')[0]+'\n')}}})();
