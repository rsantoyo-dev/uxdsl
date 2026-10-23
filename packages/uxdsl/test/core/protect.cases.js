'use strict';

// MIG-B9-10 (FEAT-010): the protect/restore cases — what the end-to-end pipeline
// (protect → Dart Sass → restore → the UXDSL plugin) must produce for UXDSL
// syntax written inside real SCSS. The ids and intents are the normative list of
// the story's §7.2.
//
// An expectation is one of:
// - a CSS string: the final CSS, compared after `flat()` (see protect.test.js);
// - `{ sameAs: source }`: the final CSS equals what the UXDSL plugin alone
//   (`uxdsl/postcss`, no Sass) produces for `source`, the case written without
//   Sass constructs. If the plugin rejects `source`, the case must fail with
//   the same UXD_* code. This pins the UXDSL semantics without restating
//   generated CSS by hand;
// - `'ERROR:<code>'`: compile() rejects the case with that code.
//
// `warning: '<code>'` adds that compile() reports a warning with that code.
//
// `verify: '…'` marks an expectation that depends on a Dart Sass behavior this
// list was written without running Sass on (the session had no registry
// access); MIG-B9-13 confirms each one against live Sass before flipping the
// case from todo to test, and records any it had to change.

// The theme every case runs against, merged over the base theme.
const THEME = {
  spacing: { '0-5': '2px', '10-2': '40px' },
  palette: {
    brand: { main: '#3355ff', dark: '#2244cc', contrast: '#ffffff', light: '#ccd5ff', 100: '#eef1ff' },
  },
};

const CASES = [
  // --- Strings: token and directive text inside a string is text.
  ['S1', '.a { content: "space(2)"; }', '.a { content: "space(2)"; }'],
  ['S2', '.a { content: "a (b) c"; padding: space(2); }', { sameAs: '.a { content: "a (b) c"; padding: space(2); }' }],
  ['S3', '.a { content: "@ds-surface(contained)"; }', '.a { content: "@ds-surface(contained)"; }'],
  ['S4', '.a { content: "say \\"space(2)\\""; }', `.a { content: 'say "space(2)"'; }`, { verify: 'Dart Sass re-quotes a string holding double quotes with single quotes' }],
  ['S5', '$t: primary;\n.a { content: "#{$t}.main"; }', '.a { content: "primary.main"; }'],

  // --- Comments.
  ['C1', '.a { color: red; /* palette(primary.main) */ }', '.a { color: red; /* palette(primary.main) */ }'],
  ['C2', '.a {\n  color: red; // space(2)\n}', '.a { color: red; }'],
  ['C3', '/* @ds-surface($x) */\n.a { color: red; }', '/* @ds-surface($x) */ .a { color: red; }'],
  ['C4', '.a { content: "/*"; padding: space(2); }', { sameAs: '.a { content: "/*"; padding: space(2); }' }],
  ['C5', '.a { padding: space(2) /* gap */; }', { sameAs: '.a { padding: space(2); }' }, { verify: 'Dart Sass drops a loud comment inside a declaration value' }],

  // --- Nested parentheses.
  ['N1', '.a { color: color-mix(in srgb, palette(primary.main) 50%, white); }', { sameAs: '.a { color: color-mix(in srgb, palette(primary.main) 50%, white); }' }],
  ['N2', '.a { width: calc(100% - space(4)); }', { sameAs: '.a { width: calc(100% - space(4)); }' }],
  ['N3', '.a { padding: xs(space(2)) md(space(4)); }', { sameAs: '.a { padding: xs(space(2)) md(space(4)); }' }],
  ['N4', '@use "sass:math";\n.a { color: palette(primary.main, math.div(1, 2)); }', { sameAs: '.a { color: palette(primary.main, 0.5); }' }],
  ['N5', '.a { box-shadow: 0 1px 2px palette(primary.main), 0 2px 4px palette(secondary.main); }', { sameAs: '.a { box-shadow: 0 1px 2px palette(primary.main), 0 2px 4px palette(secondary.main); }' }],
  ['N6', '$on: true;\n.a { color: if($on, palette(primary.main), palette(secondary.main)); }', { sameAs: '.a { color: palette(primary.main); }' }, { verify: 'Sass\'s if() function (possibly deprecated in favor of CSS if() in the pinned Sass)' }],

  // --- Interpolation.
  ['I1', '$t: primary;\n.a { color: palette(#{$t}.main); }', { sameAs: '.a { color: palette(primary.main); }' }],
  ['I2', '@each $t in primary, secondary {\n  .btn-#{$t} { color: palette(#{$t}.main); }\n}', { sameAs: '.btn-primary { color: palette(primary.main); }\n.btn-secondary { color: palette(secondary.main); }' }],
  ['I3', '.a { padding: #{space(2)}; }', { sameAs: '.a { padding: space(2); }' }],
  ['I4', '$k: "2";\n.a { padding: space(#{$k}); }', { sameAs: '.a { padding: space(2); }' }],
  ['I5', '$g: 4px;\n.a { width: calc(100% - #{$g * 2}); }', '.a { width: calc(100% - 8px); }'],
  ['I6', '$f: primary;\n$v: dark;\n.a { color: palette(#{$f}.#{$v}); }', { sameAs: '.a { color: palette(primary.dark); }' }],

  // --- url().
  ['U1', '.a { background: url(//cdn.example.com/x.png); }', '.a { background: url(//cdn.example.com/x.png); }'],
  ['U2', '.a { background: url("space(2).png"); }', '.a { background: url("space(2).png"); }'],
  ['U3', '.a { background: url(space(2).png); }', 'ERROR:UXD_SASS', { verify: 'Dart Sass rejects `(` inside an unquoted url() (the prototype saw "Expected digit")' }],

  // --- Directive parameters.
  ['D1', '$tones: (primary: 1, secondary: 2);\n@each $t, $n in $tones {\n  .s-#{$t} { @ds-surface(contained $t $n); }\n}', { sameAs: '.s-primary { @ds-surface(contained primary 1); }\n.s-secondary { @ds-surface(contained secondary 2); }' }],
  ['D2', '$tones: (primary: 1, secondary: 2);\n@each $t, $n in $tones {\n  .s-#{$t} { @ds-surface(contained #{$t} #{$n}); }\n}', { sameAs: '.s-primary { @ds-surface(contained primary 1); }\n.s-secondary { @ds-surface(contained secondary 2); }' }],
  ['D3', '$r: 3;\n.a { @ds-surface(contained radius($r)); }', { sameAs: '.a { @ds-surface(contained radius(3)); }' }],
  ['D4', '@use "sass:math" as m;\n.a { @ds-surface(contained m.$e); }', { sameAs: '.a { @ds-surface(contained 2.7182818285); }' }, { verify: 'Sass serializes math.$e with ten decimals' }],
  ['D5', '.a { @ds-surface (contained); }', { sameAs: '.a { @ds-surface(contained); }' }],
  ['D6', '.a { @DS-SURFACE(contained); }', { sameAs: '.a { @ds-surface(contained); }' }],
  ['D7', '.a { @ds-surface(contained /* ) */ primary); }', { sameAs: '.a { @ds-surface(contained primary); }' }, { verify: 'how Sass serializes a comment inside an unknown at-rule\'s parameters' }],
  ['D8', '@each $t in primary {\n  .b-#{$t} {\n    @ds-button(\n      contained\n      $t\n    );\n  }\n}', { sameAs: '.b-primary { @ds-button(contained primary); }' }],
  ['D9', '@mixin title($r) { @ds-typo($r); }\n.a { @include title(h2); }', { sameAs: '.a { @ds-typo(h2); }' }],
  ['D10', '.a {\n  @media (min-width: 600px) { @ds-surface(contained); }\n}', { sameAs: '@media (min-width: 600px) { .a { @ds-surface(contained); } }' }],

  // --- Maps.
  ['M1', '@use "sass:map";\n$pads: (sm: space(1), lg: space(4));\n.a { padding: map.get($pads, lg); }', { sameAs: '.a { padding: space(4); }' }],
  ['M2', '$c: (a: palette(primary.main), b: palette(error.main));\n@each $k, $v in $c {\n  .t-#{$k} { color: $v; }\n}', { sameAs: '.t-a { color: palette(primary.main); }\n.t-b { color: palette(error.main); }' }],

  // --- !important.
  ['IM1', '.a { padding: space(2) !important; }', { sameAs: '.a { padding: space(2) !important; }' }],
  ['IM2', '.a { padding: xs(space(1)) md(space(2)) !important; }', { sameAs: '.a { padding: xs(space(1)) md(space(2)) !important; }' }],

  // --- Multi-line.
  ['ML1', '.a {\n  box-shadow:\n    0 1px 2px palette(primary.main),\n    0 2px 4px palette(secondary.main);\n}', { sameAs: '.a { box-shadow: 0 1px 2px palette(primary.main), 0 2px 4px palette(secondary.main); }' }],
  ['ML2', '.a { padding: space(\n  2\n); }', { sameAs: '.a { padding: space(2); }' }],

  // --- Native color functions are never touched; color()/palette() tokens are.
  ['NC1', '.a { color: color(display-p3 1 0 0); }', '.a { color: color(display-p3 1 0 0); }'],
  ['NC2', '.a { color: color(srgb 1 0 0 / 0.5); }', '.a { color: color(srgb 1 0 0 / 0.5); }'],
  ['NC3', '.a { color: color(from palette(primary.main) srgb r g b / 0.5); }', { sameAs: '.a { color: color(from palette(primary.main) srgb r g b / 0.5); }' }, { verify: 'Dart Sass passes relative color() syntax through' }],
  ['NC4', '.a { color: rgb(from palette(primary.main) r g b / 50%); }', { sameAs: '.a { color: rgb(from palette(primary.main) r g b / 50%); }' }, { verify: 'Dart Sass passes relative rgb() syntax through' }],
  ['NC5', '.a { color: color(white); }', { sameAs: '.a { color: color(white); }' }, { verify: 'Dart Sass >= 1.79 parses color() as CSS Color 4; protect must cover it' }],
  ['NC6', '.a { color: color(black, 0.5); }', { sameAs: '.a { color: color(black, 0.5); }' }, { verify: 'as NC5' }],
  ['NC7', '.a { color: color(gray.900); }', { sameAs: '.a { color: color(gray.900); }' }],
  ['NC8', '.a { color: palette(primary); }', { sameAs: '.a { color: palette(primary); }' }],

  // --- Keys Sass would evaluate if left unprotected.
  ['K1', '.a { padding: space(0-5); }', { sameAs: '.a { padding: space(0-5); }' }],
  ['K2', '.a { padding: space(10-2); }', { sameAs: '.a { padding: space(10-2); }' }],
  ['K3', '.a { color: palette(brand.100); }', { sameAs: '.a { color: palette(brand.100); }' }],
  ['K4', '.a { color: color(Gray.900); }', { sameAs: '.a { color: color(Gray.900); }' }],
  ['K5', '.a { color: PALETTE(primary.main); }', { sameAs: '.a { color: PALETTE(primary.main); }' }],

  // --- Other.
  ['O1', '@uxdsl theme;\n.a { color: red; }', { sameAs: '@uxdsl theme;\n.a { color: red; }' }],
  // FEAT-010 DEC-17 (decided 2026-10-23): the author's function wins, with a warning.
  ['O2', '@function space($k) { @return $k; }\n.a { padding: space(2); }', '.a { padding: 2; }', { warning: 'UXD_FUNCTION_SHADOWED' }],
  ['O3', '@function md($v) { @return $v; }\n.a { padding: md(2px); }', '.a { padding: 2px; }', { warning: 'UXD_FUNCTION_SHADOWED' }],
  ['O4', '@mixin border($w) { border: $w solid red; }\n.a { @include border(1px); }', '.a { border: 1px solid red; }'],
  ['O5', '.a { color: tone(main); }', 'ERROR:UXD_TONE_CONTEXT'],
  ['O6', '$gap: space(2);\n.a { gap: $gap; }', { sameAs: '.a { gap: space(2); }' }],
  ['O7', '@mixin pad($p) { padding: $p; }\n.a { @include pad(density(2)); }', { sameAs: '.a { padding: density(2); }' }],
  ['O8', '@keyframes k {\n  from { padding: space(1); }\n  to { padding: space(4); }\n}', { sameAs: '@keyframes k { from { padding: space(1); } to { padding: space(4); } }' }],
  ['O9', '.a:is(.space, .shadow) { color: red; }\n%shadow { color: blue; }\n.b { @extend %shadow; }', '.a:is(.space, .shadow) { color: red; }\n.b { color: blue; }'],
];

module.exports = { THEME, CASES };
