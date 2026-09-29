#!/usr/bin/env node
/** Writes every probe case into ./cases. Re-run to regenerate. */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'cases');
fs.mkdirSync(dir, { recursive: true });

const cases = {
  // ---------- Variables ----------
  'vars-01-basic': `$x: 1px;\n.a { width: $x; }`,
  'vars-02-selector-interp': `$n: foo;\n.card-#{$n} { color: red; }`,
  'vars-03-property-name': `$p: margin;\n.a { #{$p}-top: 1px; }`,
  'vars-04-media-query': `$bp: 600px;\n@media (min-width: $bp) { .a { color: red; } }\n@media (min-width: #{$bp}) { .b { color: red; } }`,
  'vars-05-default-flag': `$x: 1px;\n$x: 2px !default;\n$y: 3px !default;\n.a { width: $x; height: $y; }`,
  'vars-06-scope': `$c: red;\n.a { $c: blue; color: $c; }\n.b { color: $c; }`,
  'vars-07-global-flag': `$c: red;\n.a { $c: blue !global; color: $c; }\n.b { color: $c; }`,
  'vars-08-map-get': `$m: (a: 1px, b: 2px);\n.a { width: map-get($m, a); }`,
  'vars-09-list-nth': `$l: 1px 2px 3px;\n.a { width: nth($l, 2); }`,
  'vars-10-in-shorthand': `$a: 1px;\n$b: solid;\n.a { border: $a $b red; }`,

  // ---------- Nesting ----------
  'nest-01-basic': `.a { color: red; .b { color: blue; } }`,
  'nest-02-amp-hover': `.a { color: red; &:hover { color: blue; } }`,
  'nest-03-amp-suffix': `.a { color: red; &-suffix { color: blue; } }`,
  'nest-04-amp-plus-amp': `.a { color: red; & + & { margin: 0; } }`,
  'nest-05-parent-amp': `.a { color: red; .x & { color: blue; } }`,
  'nest-06-media-inside-rule': `.a { color: red; @media (min-width: 600px) { color: blue; } }`,
  'nest-07-at-root': `.a { color: red; @at-root .b { color: blue; } }`,
  'nest-08-native-form': `.a { color: red; & .b { color: blue; } }`,
  'nest-09-responsive-in-nested': `.a { .b { padding: xs(1px) md(2px); } }`,
  'nest-10-amp-hover-responsive': `.a { &:hover { padding: xs(1px) md(2px); } }`,
  'nest-11-directive-in-nested': `.a { color: red; &:hover { @ds-surface(contained); } }`,
  'nest-12-directive-parent-with-amp': `.a { @ds-surface(contained); &:hover { color: blue; } }`,

  // ---------- Mixins ----------
  'mixin-01-default-arg': `@mixin m($a: 1px) { width: $a; }\n.a { @include m; }\n.b { @include m(2px); }`,
  'mixin-02-keyword-arg': `@mixin m($a: 1px, $b: 2px) { width: $a; height: $b; }\n.a { @include m($b: 9px); }`,
  'mixin-03-content': `@mixin mq { @media (min-width: 600px) { @content; } }\n.a { @include mq { color: red; } }`,
  'mixin-04-uxdsl-fn-param': `@mixin pad($p) { padding: $p; }\n.a { @include pad(density(2)); }`,
  'mixin-05-responsive-arg': `@mixin pad($p) { padding: $p; }\n.a { @include pad(xs(1px) md(2px)); }`,
  'mixin-06-emits-directive': `@mixin card { @ds-surface(contained); }\n.a { @include card; }`,
  'mixin-07-typo-in-content': `@mixin wrap { .inner { @content; } }\n.a { @include wrap { @ds-typo(h1); } }`,
  'mixin-08-param-as-directive-arg': `@mixin card($tone) { .card-#{$tone} { @ds-surface($tone, 1); background: palette(#{$tone}-main); } }\n@include card(primary);`,
  'mixin-09-nested-selector-in-mixin': `@mixin hov { &:hover { color: red; } }\n.a { @include hov; }`,
  'mixin-10-variadic': `@mixin sh($shadows...) { box-shadow: $shadows; }\n.a { @include sh(0 1px 2px red, 0 2px 4px blue); }`,
  // Workarounds / edge cases for the "function call inside @include args" bug
  'mixin-11-workaround-var': `@mixin pad($p) { padding: $p; }\n$d: density(2);\n.a { @include pad($d); }`,
  'mixin-12-workaround-interp': `@mixin pad($p) { padding: $p; }\n.a { @include pad(#{density(2)}); }`,
  'mixin-13-workaround-responsive-var': `@mixin pad($p) { padding: $p; }\n$r: xs(1px) md(2px);\n.a { @include pad($r); }`,
  'mixin-14-css-fn-arg-with-comma': `@mixin box($w, $h) { width: $w; height: $h; }\n.a { @include box(rgba(0,0,0,.5), 2px); }`,
  'mixin-15-calc-arg': `@mixin m($a) { width: $a; }\n.a { @include m(calc(100% - 2px)); }`,
  'mixin-16-nested-include': `@mixin a { color: red; }\n@mixin b { @include a; border: 0; }\n.x { @include b; }`,

  // ---------- Functions ----------
  'fn-01-custom-function': `@function double($n) { @return $n * 2; }\n.a { width: double(2px); }`,
  'fn-02-darken': `.a { color: darken(#3b82f6, 10%); }`,
  'fn-03-lighten': `.a { color: lighten(#3b82f6, 10%); }`,
  'fn-04-rgba-var': `$c: #000;\n.a { color: rgba($c, .5); }`,
  'fn-05-math-div': `@use "sass:math";\n.a { width: math.div(10px, 2); }`,
  'fn-06-percentage': `.a { width: percentage(0.5); }`,
  'fn-07-if': `$x: true;\n.a { width: if($x, 1px, 2px); }`,
  'fn-08-unquote': `$s: "foo";\n.a { content: unquote($s); font-family: unquote("Inter"); }`,
  'fn-09-string-fns': `.a { content: str-slice("hello", 1, 2); width: str-length("abc"); font-family: to-upper-case("inter"); }`,
  'fn-10-map-module': `@use "sass:map";\n$m: (a: 1px);\n.a { width: map.get($m, a); }`,
  'fn-11-color-adjust': `@use "sass:color";\n.a { color: color.adjust(#3b82f6, $lightness: -10%); }`,

  // ---------- Control flow ----------
  'ctrl-01-if-else': `$t: ocean;\n.a { @if $t == ocean { color: blue; } @else { color: black; } }`,
  'ctrl-02-else-if': `$t: 2;\n.a { @if $t == 1 { color: red; } @else if $t == 2 { color: green; } @else { color: blue; } }`,
  'ctrl-03-each-list': `@each $n in (a, b) { .x-#{$n} { color: red; } }`,
  'ctrl-04-each-map': `@each $k, $v in (a: 1px, b: 2px) { .x-#{$k} { width: $v; } }`,
  'ctrl-05-for-through': `@for $i from 1 through 3 { .w-#{$i} { width: #{$i}0%; } }`,
  'ctrl-06-while': `$i: 1;\n@while $i < 3 { .w-#{$i} { width: 1px; } $i: $i + 1; }`,
  'ctrl-07-each-var-list': `$tones: primary, secondary;\n@each $t in $tones { .t-#{$t} { color: palette(#{$t}.main); } }`,
  'ctrl-08-debug-warn': `@debug "dbg";\n@warn "wrn";\n.a { color: red; }`,
  'ctrl-09-each-over-map-single-var': `$m: (a: 1px, b: 2px);\n@each $k in $m { .x-#{$k} { color: red; } }`,

  // ---------- @extend ----------
  'extend-01-placeholder': `%base { color: red; }\n.a { @extend %base; }`,
  'extend-02-class': `.base { color: red; }\n.a { @extend .base; }`,

  // ---------- Imports ----------
  'import-01-partial-no-ext': `@import "partial";\n.a { width: $from-partial; }`,
  'import-02-partial-underscore': `@import "./_partial.scss";\n.a { width: $from-partial; }`,
  'import-03-uxdsl-file': `@import "./partial-vars.uxdsl";\n.a { width: $from-uxdsl; }`,
  'import-04-css-file': `@import "./plain.css";\n.a { color: red; }`,
  'import-05-node-modules': `@import "postcss-uxdsl/theme/default-colors.css";\n.a { color: red; }`,
  'import-06-use-partial': `@use "./partial" as p;\n.a { width: p.$from-partial; }`,
  'import-07-forward': `@forward "./partial";\n.a { color: red; }`,
  'import-08-use-sass-builtin-only': `@use "sass:math";\n.a { color: red; }`,

  // ---------- Comments ----------
  'comment-01-line': `// top line\n.a { color: red; // trailing\n}`,
  'comment-02-block': `/* keep me */\n.a { color: red; /* inline */ }`,
  'comment-03-bang': `/*! license */\n.a { color: red; }`,
  'comment-04-url-slashes': `.a { background: url(https://example.com/x.png); }`,

  // ---------- Interpolation with UXDSL tokens ----------
  'interp-01-palette': `.a { color: #{palette(primary.main)}; }`,
  'interp-02-calc-var-interp': `$g: 16px;\n.a { width: calc(100% - #{$g}); }`,
  'interp-03-calc-space': `.a { width: calc(100% - space(2)); }`,
  'interp-04-calc-var-plain': `$g: 16px;\n.a { width: calc(100% - $g); }`,
  'interp-05-var-holding-token': `$c: palette(primary.main);\n.a { color: $c; }`,

  // ---------- Modern CSS passthrough ----------
  'modern-01-container': `.wrap { container-type: inline-size; }\n@container (min-width: 400px) { .a { color: red; } }`,
  'modern-02-layer': `@layer base, components;\n@layer base { .a { color: red; } }`,
  'modern-03-has-is': `.a:has(> .b) { color: red; }\n:is(.a, .b) .c { color: blue; }`,
  'modern-04-supports': `@supports (display: grid) { .a { display: grid; } }`,
  'modern-05-property': `@property --x { syntax: '<length>'; inherits: false; initial-value: 0px; }`,
  'modern-06-custom-props-fallback': `.a { --gap: 1rem; padding: var(--gap, 8px); }`,
  'modern-07-custom-prop-undefined': `.a { color: var(--host-color, red); }`,
  'modern-08-color-mix': `.a { color: color-mix(in srgb, palette(primary.main) 50%, white); }`,
  'modern-09-font-face': `@font-face { font-family: "X"; src: url(x.woff2) format("woff2"); }`,
  'modern-10-keyframes-tokens': `@keyframes pulse { from { padding: space(1); } to { padding: space(2); } }\n.a { animation: pulse 1s; }`,
  'modern-11-keyframes-responsive': `@keyframes pulse { from { padding: xs(1px) md(2px); } to { padding: 3px; } }`,
  'modern-12-supports-with-tokens': `@supports (display: grid) { .a { gap: density(2); padding: xs(1px) md(2px); } }`,

  // ---------- Interaction with UXDSL ----------
  'interact-01-var-holds-responsive': `$pad: xs(1px) md(2px);\n.a { padding: $pad; }`,
  'interact-02-var-inside-xs': `$s: 1px;\n.a { padding: xs($s) md(2px); }`,
  'interact-03-var-inside-xs-interp': `$s: 1px;\n.a { padding: xs(#{$s}) md(2px); }`,
  'interact-04-var-holds-density': `$d: density(2);\n.a { padding: $d; }`,
  'interact-05-each-emits-directive': `@each $t in (primary, secondary) { .btn-#{$t} { @ds-button(contained $t); } }`,

  // ---------- Arithmetic ----------
  'arith-01-slash-div': `.a { width: 10px / 2; }`,
  'arith-02-string-concat': `$a: "foo";\n.a { content: $a + "bar"; }`,
  'arith-03-unit-mismatch': `.a { width: 1rem + 2px; }`,
  'arith-04-mul': `.a { width: 10px * 2; }`,
  'arith-05-var-mul': `$x: 10px;\n.a { width: $x * 2; }`,
  'arith-06-add-vars': `$a: 1px;\n$b: 2px;\n.a { width: $a + $b; }`,
  'arith-07-unitless-add': `$n: 1;\n.a { z-index: $n + 1; }`,

  // ---------- Dart Sass tolerance of UXDSL syntax (read the Sass column) ----------
  'sass-tol-01-responsive-fn': `.a { padding: xs(1px) md(2px); }`,
  'sass-tol-02-palette-dot': `.a { color: palette(primary.main); }`,
  'sass-tol-03-palette-plain': `.a { color: palette(primary); }`,
  'sass-tol-04-density': `.a { gap: density(2); }`,
  'sass-tol-05-ds-surface': `.a { @ds-surface(contained); }`,
  'sass-tol-06-ds-button-args': `.a { @ds-button(contained primary 2); }`,
  'sass-tol-07-ds-typo': `.a { @ds-typo(h1); }`,
  'sass-tol-08-responsive-space': `.a { padding: xs(space(1)) md(space(2)); }`,
  'sass-tol-09-radius-keyword': `.a { border-radius: radius(pill); }`,
};

// Supporting files for the import cases.
const support = {
  '_partial.scss': `$from-partial: 42px;\n.from-partial { color: red; }`,
  'partial-vars.uxdsl': `$from-uxdsl: 7px;\n.from-uxdsl { color: blue; }`,
  'plain.css': `.plain { color: green; }`,
};

for (const [name, src] of Object.entries(cases)) fs.writeFileSync(path.join(dir, `${name}.uxdsl`), `${src}\n`);
for (const [name, src] of Object.entries(support)) fs.writeFileSync(path.join(dir, name), `${src}\n`);
console.log(`wrote ${Object.keys(cases).length} cases + ${Object.keys(support).length} support files to ${dir}`);
