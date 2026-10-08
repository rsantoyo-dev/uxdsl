const core = require('/Users/ricardosantoyo/Documents/projects/uxdsl/packages/uxdsl-core/dist/index.js');
const cases = [
  ['nested rule + directive', '.a { .b { @ds-button(outlined); } &:hover { color: xs(red) md(blue); } }'],
  ['rule-scoped $var', '.a { $local: 2px; padding: xs($local) md(4px); }'],
  ['root $var responsive', '$gap: xs(1px) md(2px);\n.a { gap: $gap; }'],
  ['@mixin with responsive param', '@mixin pad($v) { padding: $v; }\n.a { @include pad(xs(1px) md(2px)); }'],
  ['@mixin with directive inside', '@mixin card { @ds-surface(outlined); }\n.a { @include card; }'],
  ['@each', '@each $n in 1, 2 { .p-#{$n} { padding: space($n); } }'],
  ['@if', '$dark: true;\n.a { @if $dark { color: palette(dark); } @else { color: palette(light); } }'],
  ['interpolation in function', '$k: 2;\n.a { padding: space(#{$k}); }'],
  ['// comments', '// a comment with url(http://x)\n.a { color: red; } /* keep */'],
  ['directive inside @media', '@media (min-width: 768px) { .a { @ds-surface(outlined); } }'],
  ['$var with palette', '$c: palette(primary);\n.a { color: $c; }'],
  ['nested & responsive + media order', '.a { padding: xs(1px) md(2px); .b { padding: xs(3px) md(4px); } }'],
];
(async () => {
  for (const [label, source] of cases) {
    console.log('=== ' + label + '\n' + source.replace(/\n/g, '\\n '));
    try {
      const r = await core.compile({ source, from: '/tmp/x.uxdsl' }, { theme: {}, includeTheme: false, references: { mode: 'error' } });
      console.log(r.css.replace(/\n\s*\n/g, '\n').trim());
      if (r.warnings.length) console.log('warnings', r.warnings);
    } catch (e) {
      console.log('ERROR', e.name, '|', (e.message || '').split('\n').slice(0, 3).join(' // '));
    }
    console.log();
  }
  // includeTheme true meta
  const r = await core.compile({ source: '.a { color: red; }', from: '/tmp/x.uxdsl' }, { theme: {}, includeTheme: true });
  console.log('=== includeTheme:true tail');
  console.log(r.css.slice(-260));
})();
