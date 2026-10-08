'use strict';

// Stability phase 3 (audit §3.2, decision DE-2): the SCSS subset `compile()`
// accepts, made exact. The 110 cases are the audit's own probe matrix
// (docs/audits/2026-09-29-probes/scss/make-cases.js on the docs/stability-audit
// branch). Each one either compiles to the CSS pinned here — valid CSS, with no
// Sass construct left in it — or fails with the located error pinned here.
// There is no third outcome: the audit found 14 cases that compiled to invalid
// CSS with exit 0 (`@include pad(density(2))` -> `padding: densit;`,
// `&__item`, `darken()`, `10px * 2`, `@extend`, `!global`, `@while`, …);
// this suite fails if any case ever does again.
//
// Legend of the error column: a `UXD_*` code is one of ours (the
// scss-subset guard, the include-argument pre-pass or the compiler);
// `postcss-advanced-variables` / `postcss-import` is a located error of that
// plugin, kept because it is an error, not output.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const postcss = require('postcss');
const csstree = require('css-tree');
const core = require('../../dist/entries/index.js');

const FIXTURES = path.join(__dirname, 'fixtures/scss-subset');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-scss-subset-'));
for (const file of fs.readdirSync(FIXTURES)) fs.copyFileSync(path.join(FIXTURES, file), path.join(dir, file));

const normalize = (css) => css.replace(/\s+/g, ' ').trim();

/** Everything that would make a compiled stylesheet invalid or Sass-flavoured. */
function problemsOf(css, { authorValue = false } = {}) {
  const problems = [];
  let root;
  try { root = postcss.parse(css); } catch (error) { return ['does not parse as CSS: ' + error.reason]; }
  root.walk((node) => {
    if (node.type === 'atrule' && /^(extend|use|forward|function|return|while|at-root|debug|warn|error|include|mixin|if|else|each|for)$/.test(node.name)) problems.push('@' + node.name + ' left in the output');
    if (node.type === 'atrule' && /#\{|\$[a-zA-Z_]/.test(node.params)) problems.push('@' + node.name + ' ' + node.params);
    if (node.type === 'rule' && /#\{|(^|[\s,>+~(])%[a-zA-Z_-]|&[A-Za-z0-9_-]/.test(node.selector)) problems.push('selector ' + node.selector);
    if (node.type !== 'decl') return;
    const { prop, value } = node;
    if (prop.startsWith('$') || /#\{/.test(prop)) problems.push('declaration ' + prop);
    if (/#\{|\$[a-zA-Z_][\w-]*|!global|\b(darken|lighten|map-get|nth|percentage|unquote|str-slice|str-length|to-upper-case)\(|[a-z]+\.[a-z-]+\(/.test(value)) problems.push(prop + ': ' + value);
    // css-tree's lexer judges the value against the property's grammar; it cannot
    // follow var(), and a value the author wrote nonsensically on purpose
    // (`width: rgba(…)`) is theirs, not the compiler's.
    if (!prop.startsWith('--') && !value.includes('var(') && !authorValue) {
      const match = csstree.lexer.matchProperty(prop, value);
      if (match.error && match.error.name !== 'SyntaxReferenceError') problems.push(prop + ': ' + value + ' (' + match.error.message.split('\n')[0] + ')');
    }
  });
  return problems;
}

const CASES = [
  ["vars-01-basic", "$x: 1px;\n.a { width: $x; }", { css: ".a { width: 1px; }" }],
  ["vars-02-selector-interp", "$n: foo;\n.card-#{$n} { color: red; }", { css: ".card-foo { color: red; }" }],
  ["vars-03-property-name", "$p: margin;\n.a { #{$p}-top: 1px; }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["vars-04-media-query", "$bp: 600px;\n@media (min-width: $bp) { .a { color: red; } }\n@media (min-width: #{$bp}) { .b { color: red; } }", { css: "@media (min-width: 600px) { .a { color: red; } } @media (min-width: 600px) { .b { color: red; } }" }],
  ["vars-05-default-flag", "$x: 1px;\n$x: 2px !default;\n$y: 3px !default;\n.a { width: $x; height: $y; }", { css: ".a { width: 1px; height: 3px; }" }],
  ["vars-06-scope", "$c: red;\n.a { $c: blue; color: $c; }\n.b { color: $c; }", { css: ".a { color: blue; } .b { color: red; }" }],
  ["vars-07-global-flag", "$c: red;\n.a { $c: blue !global; color: $c; }\n.b { color: $c; }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["vars-08-map-get", "$m: (a: 1px, b: 2px);\n.a { width: map-get($m, a); }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["vars-09-list-nth", "$l: 1px 2px 3px;\n.a { width: nth($l, 2); }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["vars-10-in-shorthand", "$a: 1px;\n$b: solid;\n.a { border: $a $b red; }", { css: ".a { border: 1px solid red; }" }],
  ["nest-01-basic", ".a { color: red; .b { color: blue; } }", { css: ".a { color: red; .b { color: blue; } }" }],
  ["nest-02-amp-hover", ".a { color: red; &:hover { color: blue; } }", { css: ".a { color: red; &:hover { color: blue; } }" }],
  ["nest-03-amp-suffix", ".a { color: red; &-suffix { color: blue; } }", { error: "UXD_NESTING_INVALID" }],
  ["nest-04-amp-plus-amp", ".a { color: red; & + & { margin: 0; } }", { css: ".a { color: red; & + & { margin: 0; } }" }],
  ["nest-05-parent-amp", ".a { color: red; .x & { color: blue; } }", { css: ".a { color: red; .x & { color: blue; } }" }],
  ["nest-06-media-inside-rule", ".a { color: red; @media (min-width: 600px) { color: blue; } }", { css: ".a { color: red; @media (min-width: 600px) { color: blue; } }" }],
  ["nest-07-at-root", ".a { color: red; @at-root .b { color: blue; } }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["nest-08-native-form", ".a { color: red; & .b { color: blue; } }", { css: ".a { color: red; & .b { color: blue; } }" }],
  ["nest-09-responsive-in-nested", ".a { .b { padding: xs(1px) md(2px); } }", { css: ".a { .b { padding: 1px; } @media (min-width: 768px) { .b { padding: 2px; } } }" }],
  ["nest-10-amp-hover-responsive", ".a { &:hover { padding: xs(1px) md(2px); } }", { css: ".a { &:hover { padding: 1px; } @media (min-width: 768px) { &:hover { padding: 2px; } } }" }],
  ["nest-11-directive-in-nested", ".a { color: red; &:hover { @ds-surface(contained); } }", { css: ".a { color: red; &:hover { padding: var(--uxdsl__surface__contained-padding); border-radius: var(--uxdsl__surface__contained-radius); background: var(--uxdsl__surface__contained-bg); color: var(--uxdsl__surface__contained-color); border: var(--uxdsl__surface__contained-border); box-shadow: var(--uxdsl__surface__contained-shadow); } }" }],
  ["nest-12-directive-parent-with-amp", ".a { @ds-surface(contained); &:hover { color: blue; } }", { css: ".a { padding: var(--uxdsl__surface__contained-padding); border-radius: var(--uxdsl__surface__contained-radius); background: var(--uxdsl__surface__contained-bg); color: var(--uxdsl__surface__contained-color); border: var(--uxdsl__surface__contained-border); box-shadow: var(--uxdsl__surface__contained-shadow); &:hover { color: blue; } }" }],
  ["mixin-01-default-arg", "@mixin m($a: 1px) { width: $a; }\n.a { @include m; }\n.b { @include m(2px); }", { css: ".a { width: 1px; } .b { width: 2px; }" }],
  ["mixin-02-keyword-arg", "@mixin m($a: 1px, $b: 2px) { width: $a; height: $b; }\n.a { @include m($b: 9px); }", { error: "postcss-advanced-variables" }],
  ["mixin-03-content", "@mixin mq { @media (min-width: 600px) { @content; } }\n.a { @include mq { color: red; } }", { css: ".a { @media (min-width: 600px) { color: red; } }" }],
  ["mixin-04-uxdsl-fn-param", "@mixin pad($p) { padding: $p; }\n.a { @include pad(density(2)); }", { css: ".a { padding: var(--uxdsl__density__2); }" }],
  ["mixin-05-responsive-arg", "@mixin pad($p) { padding: $p; }\n.a { @include pad(xs(1px) md(2px)); }", { css: ".a { padding: 1px; }@media (min-width: 768px) {.a { padding: 2px; } }" }],
  ["mixin-06-emits-directive", "@mixin card { @ds-surface(contained); }\n.a { @include card; }", { css: ".a { padding: var(--uxdsl__surface__contained-padding); border-radius: var(--uxdsl__surface__contained-radius); background: var(--uxdsl__surface__contained-bg); color: var(--uxdsl__surface__contained-color); border: var(--uxdsl__surface__contained-border); box-shadow: var(--uxdsl__surface__contained-shadow); }" }],
  ["mixin-07-typo-in-content", "@mixin wrap { .inner { @content; } }\n.a { @include wrap { @ds-typo(h1); } }", { css: ".a { .inner { font-family: var(--uxdsl__typography__h1-font-family); font-size: var(--uxdsl__typography__h1-font-size); line-height: var(--uxdsl__typography__h1-line-height); font-weight: var(--uxdsl__typography__h1-font-weight); letter-spacing: var(--uxdsl__typography__h1-letter-spacing); margin-block-start: var(--uxdsl__typography__h1-margin-block-start); margin-block-end: var(--uxdsl__typography__h1-margin-block-end); } }" }],
  ["mixin-08-param-as-directive-arg", "@mixin card($tone) { .card-#{$tone} { @ds-surface($tone, 1); background: palette(#{$tone}-main); } }\n@include card(primary);", { error: "UXD_SURFACE_ARGUMENT" }],
  ["mixin-09-nested-selector-in-mixin", "@mixin hov { &:hover { color: red; } }\n.a { @include hov; }", { css: ".a { &:hover { color: red; } }" }],
  ["mixin-10-variadic", "@mixin sh($shadows...) { box-shadow: $shadows; }\n.a { @include sh(0 1px 2px red, 0 2px 4px blue); }", { error: "postcss-advanced-variables" }],
  ["mixin-11-workaround-var", "@mixin pad($p) { padding: $p; }\n$d: density(2);\n.a { @include pad($d); }", { css: ".a { padding: var(--uxdsl__density__2); }" }],
  ["mixin-12-workaround-interp", "@mixin pad($p) { padding: $p; }\n.a { @include pad(#{density(2)}); }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["mixin-13-workaround-responsive-var", "@mixin pad($p) { padding: $p; }\n$r: xs(1px) md(2px);\n.a { @include pad($r); }", { css: ".a { padding: 1px; }@media (min-width: 768px) {.a { padding: 2px; } }" }],
  ["mixin-14-css-fn-arg-with-comma", "@mixin box($w, $h) { width: $w; height: $h; }\n.a { @include box(rgba(0,0,0,.5), 2px); }", { css: ".a { width: rgba(0,0,0,.5); height: 2px; }", authorValue: true }],
  ["mixin-15-calc-arg", "@mixin m($a) { width: $a; }\n.a { @include m(calc(100% - 2px)); }", { css: ".a { width: calc(100% - 2px); }" }],
  ["mixin-16-nested-include", "@mixin a { color: red; }\n@mixin b { @include a; border: 0; }\n.x { @include b; }", { css: ".x { color: red; border: 0; }" }],
  ["fn-01-custom-function", "@function double($n) { @return $n * 2; }\n.a { width: double(2px); }", { error: "postcss-advanced-variables" }],
  ["fn-02-darken", ".a { color: darken(#3b82f6, 10%); }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["fn-03-lighten", ".a { color: lighten(#3b82f6, 10%); }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["fn-04-rgba-var", "$c: #000;\n.a { color: rgba($c, .5); }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["fn-05-math-div", "@use \"sass:math\";\n.a { width: math.div(10px, 2); }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["fn-06-percentage", ".a { width: percentage(0.5); }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["fn-07-if", "$x: true;\n.a { width: if($x, 1px, 2px); }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["fn-08-unquote", "$s: \"foo\";\n.a { content: unquote($s); font-family: unquote(\"Inter\"); }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["fn-09-string-fns", ".a { content: str-slice(\"hello\", 1, 2); width: str-length(\"abc\"); font-family: to-upper-case(\"inter\"); }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["fn-10-map-module", "@use \"sass:map\";\n$m: (a: 1px);\n.a { width: map.get($m, a); }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["fn-11-color-adjust", "@use \"sass:color\";\n.a { color: color.adjust(#3b82f6, $lightness: -10%); }", { error: "postcss-advanced-variables" }],
  ["ctrl-01-if-else", "$t: ocean;\n.a { @if $t == ocean { color: blue; } @else { color: black; } }", { css: ".a { color: blue }" }],
  ["ctrl-02-else-if", "$t: 2;\n.a { @if $t == 1 { color: red; } @else if $t == 2 { color: green; } @else { color: blue; } }", { error: "postcss-advanced-variables" }],
  ["ctrl-03-each-list", "@each $n in (a, b) { .x-#{$n} { color: red; } }", { css: ".x-a { color: red; } .x-b { color: red; }" }],
  ["ctrl-04-each-map", "@each $k, $v in (a: 1px, b: 2px) { .x-#{$k} { width: $v; } }", { error: "postcss-advanced-variables" }],
  ["ctrl-05-for-through", "@for $i from 1 through 3 { .w-#{$i} { width: #{$i}0%; } }", { css: ".w-1 { width: 10%; } .w-2 { width: 20%; } .w-3 { width: 30%; }" }],
  ["ctrl-06-while", "$i: 1;\n@while $i < 3 { .w-#{$i} { width: 1px; } $i: $i + 1; }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["ctrl-07-each-var-list", "$tones: primary, secondary;\n@each $t in $tones { .t-#{$t} { color: palette(#{$t}.main); } }", { css: ".t-primary { color: var(--uxdsl__palette__primary-main); } .t-secondary { color: var(--uxdsl__palette__secondary-main); }" }],
  ["ctrl-08-debug-warn", "@debug \"dbg\";\n@warn \"wrn\";\n.a { color: red; }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["ctrl-09-each-over-map-single-var", "$m: (a: 1px, b: 2px);\n@each $k in $m { .x-#{$k} { color: red; } }", { css: ".x-1px { color: red; } .x-2px { color: red; }" }],
  ["extend-01-placeholder", "%base { color: red; }\n.a { @extend %base; }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["extend-02-class", ".base { color: red; }\n.a { @extend .base; }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["import-01-partial-no-ext", "@import \"partial\";\n.a { width: $from-partial; }", { error: "postcss-import" }],
  ["import-02-partial-underscore", "@import \"./_partial.scss\";\n.a { width: $from-partial; }", { css: ".from-partial { color: red; } .a { width: 42px; }" }],
  ["import-03-uxdsl-file", "@import \"./partial-vars.uxdsl\";\n.a { width: $from-uxdsl; }", { css: ".from-uxdsl { color: blue; } .a { width: 7px; }" }],
  ["import-04-css-file", "@import \"./plain.css\";\n.a { color: red; }", { css: ".plain { color: green; } .a { color: red; }" }],
  ["import-05-node-modules", "@import \"postcss-uxdsl/theme/default-colors.css\";\n.a { color: red; }", { error: "postcss-import" }],
  ["import-06-use-partial", "@use \"./partial\" as p;\n.a { width: p.$from-partial; }", { error: "postcss-advanced-variables" }],
  ["import-07-forward", "@forward \"./partial\";\n.a { color: red; }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["import-08-use-sass-builtin-only", "@use \"sass:math\";\n.a { color: red; }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["comment-01-line", "// top line\n.a { color: red; // trailing\n}", { css: ".a { color: red; }" }],
  ["comment-02-block", "/* keep me */\n.a { color: red; /* inline */ }", { css: "/* keep me */ .a { color: red; /* inline */ }" }],
  ["comment-03-bang", "/*! license */\n.a { color: red; }", { css: "/*! license */ .a { color: red; }" }],
  ["comment-04-url-slashes", ".a { background: url(https://example.com/x.png); }", { css: ".a { background: url(https://example.com/x.png); }" }],
  ["interp-01-palette", ".a { color: #{palette(primary.main)}; }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["interp-02-calc-var-interp", "$g: 16px;\n.a { width: calc(100% - #{$g}); }", { css: ".a { width: calc(100% - 16px); }" }],
  ["interp-03-calc-space", ".a { width: calc(100% - space(2)); }", { css: ".a { width: calc(100% - var(--uxdsl__space__2)); }" }],
  ["interp-04-calc-var-plain", "$g: 16px;\n.a { width: calc(100% - $g); }", { css: ".a { width: calc(100% - 16px); }" }],
  ["interp-05-var-holding-token", "$c: palette(primary.main);\n.a { color: $c; }", { css: ".a { color: var(--uxdsl__palette__primary-main); }" }],
  ["modern-01-container", ".wrap { container-type: inline-size; }\n@container (min-width: 400px) { .a { color: red; } }", { css: ".wrap { container-type: inline-size; } @container (min-width: 400px) { .a { color: red; } }" }],
  ["modern-02-layer", "@layer base, components;\n@layer base { .a { color: red; } }", { css: "@layer base, components; @layer base { .a { color: red; } }" }],
  ["modern-03-has-is", ".a:has(> .b) { color: red; }\n:is(.a, .b) .c { color: blue; }", { css: ".a:has(> .b) { color: red; } :is(.a, .b) .c { color: blue; }" }],
  ["modern-04-supports", "@supports (display: grid) { .a { display: grid; } }", { css: "@supports (display: grid) { .a { display: grid; } }" }],
  ["modern-05-property", "@property --x { syntax: '<length>'; inherits: false; initial-value: 0px; }", { css: "@property --x { syntax: '<length>'; inherits: false; initial-value: 0px; }" }],
  ["modern-06-custom-props-fallback", ".a { --gap: 1rem; padding: var(--gap, 8px); }", { css: ".a { --gap: 1rem; padding: var(--gap, 8px); }" }],
  ["modern-07-custom-prop-undefined", ".a { color: var(--host-color, red); }", { css: ".a { color: var(--host-color, red); }" }],
  ["modern-08-color-mix", ".a { color: color-mix(in srgb, palette(primary.main) 50%, white); }", { css: ".a { color: color-mix(in srgb, var(--uxdsl__palette__primary-main) 50%, white); }" }],
  ["modern-09-font-face", "@font-face { font-family: \"X\"; src: url(x.woff2) format(\"woff2\"); }", { css: "@font-face { font-family: \"X\"; src: url(x.woff2) format(\"woff2\"); }" }],
  ["modern-10-keyframes-tokens", "@keyframes pulse { from { padding: space(1); } to { padding: space(2); } }\n.a { animation: pulse 1s; }", { css: "@keyframes pulse { from { padding: var(--uxdsl__space__1); } to { padding: var(--uxdsl__space__2); } } .a { animation: pulse 1s; }" }],
  ["modern-11-keyframes-responsive", "@keyframes pulse { from { padding: xs(1px) md(2px); } to { padding: 3px; } }", { error: "UXD_BREAKPOINT_CONTEXT" }],
  ["modern-12-supports-with-tokens", "@supports (display: grid) { .a { gap: density(2); padding: xs(1px) md(2px); } }", { css: "@supports (display: grid) { .a { gap: var(--uxdsl__density__2); padding: 1px; } @media (min-width: 768px) { .a { padding: 2px; } } }" }],
  ["interact-01-var-holds-responsive", "$pad: xs(1px) md(2px);\n.a { padding: $pad; }", { css: ".a { padding: 1px; }@media (min-width: 768px) {.a { padding: 2px; } }" }],
  ["interact-02-var-inside-xs", "$s: 1px;\n.a { padding: xs($s) md(2px); }", { css: ".a { padding: 1px; }@media (min-width: 768px) {.a { padding: 2px; } }" }],
  ["interact-03-var-inside-xs-interp", "$s: 1px;\n.a { padding: xs(#{$s}) md(2px); }", { css: ".a { padding: 1px; }@media (min-width: 768px) {.a { padding: 2px; } }" }],
  ["interact-04-var-holds-density", "$d: density(2);\n.a { padding: $d; }", { css: ".a { padding: var(--uxdsl__density__2); }" }],
  ["interact-05-each-emits-directive", "@each $t in (primary, secondary) { .btn-#{$t} { @ds-button(contained $t); } }", { css: ".btn-primary { padding: var(--uxdsl__surface__contained-padding); border-radius: var(--uxdsl__surface__contained-radius); background: var(--uxdsl__palette__primary-main); color: var(--uxdsl__palette__primary-contrast); border: var(--uxdsl__surface__contained-border); box-shadow: var(--uxdsl__surface__contained-shadow); --uxdsl__button__tone-main: var(--uxdsl__palette__primary-main); --uxdsl__button__tone-dark: var(--uxdsl__palette__primary-dark); --uxdsl__button__tone-contrast: var(--uxdsl__palette__primary-contrast); } .btn-primary:hover:not(:where(:disabled, [aria-disabled=\"true\"])) { background: var(--uxdsl__button__contained-tone-primary-hover-bg, var(--uxdsl__button__contained-hover-bg)); color: var(--uxdsl__button__contained-tone-primary-hover-color, var(--uxdsl__button__contained-hover-color)); } .btn-primary:focus-visible { outline: var(--uxdsl__button__contained-tone-primary-focusvisible-outline, var(--uxdsl__button__contained-focusvisible-outline)); outline-offset: var(--uxdsl__button__contained-tone-primary-focusvisible-outline-offset, var(--uxdsl__button__contained-focusvisible-outline-offset)); } .btn-primary.is-selected, .btn-primary[aria-pressed=\"true\"], .btn-primary[aria-selected=\"true\"] { background: var(--uxdsl__button__contained-tone-primary-selected-bg, var(--uxdsl__button__contained-selected-bg)); color: var(--uxdsl__button__contained-tone-primary-selected-color, var(--uxdsl__button__contained-selected-color)); } .btn-primary:disabled, .btn-primary[aria-disabled=\"true\"] { opacity: var(--uxdsl__button__contained-tone-primary-disabled-opacity, var(--uxdsl__button__contained-disabled-opacity)); cursor: var(--uxdsl__button__contained-tone-primary-disabled-cursor, var(--uxdsl__button__contained-disabled-cursor)); } .btn-secondary { padding: var(--uxdsl__surface__contained-padding); border-radius: var(--uxdsl__surface__contained-radius); background: var(--uxdsl__palette__secondary-main); color: var(--uxdsl__palette__secondary-contrast); border: var(--uxdsl__surface__contained-border); box-shadow: var(--uxdsl__surface__contained-shadow); --uxdsl__button__tone-main: var(--uxdsl__palette__secondary-main); --uxdsl__button__tone-dark: var(--uxdsl__palette__secondary-dark); --uxdsl__button__tone-contrast: var(--uxdsl__palette__secondary-contrast); } .btn-secondary:hover:not(:where(:disabled, [aria-disabled=\"true\"])) { background: var(--uxdsl__button__contained-tone-secondary-hover-bg, var(--uxdsl__button__contained-hover-bg)); color: var(--uxdsl__button__contained-tone-secondary-hover-color, var(--uxdsl__button__contained-hover-color)); } .btn-secondary:focus-visible { outline: var(--uxdsl__button__contained-tone-secondary-focusvisible-outline, var(--uxdsl__button__contained-focusvisible-outline)); outline-offset: var(--uxdsl__button__contained-tone-secondary-focusvisible-outline-offset, var(--uxdsl__button__contained-focusvisible-outline-offset)); } .btn-secondary.is-selected, .btn-secondary[aria-pressed=\"true\"], .btn-secondary[aria-selected=\"true\"] { background: var(--uxdsl__button__contained-tone-secondary-selected-bg, var(--uxdsl__button__contained-selected-bg)); color: var(--uxdsl__button__contained-tone-secondary-selected-color, var(--uxdsl__button__contained-selected-color)); } .btn-secondary:disabled, .btn-secondary[aria-disabled=\"true\"] { opacity: var(--uxdsl__button__contained-tone-secondary-disabled-opacity, var(--uxdsl__button__contained-disabled-opacity)); cursor: var(--uxdsl__button__contained-tone-secondary-disabled-cursor, var(--uxdsl__button__contained-disabled-cursor)); }" }],
  ["arith-01-slash-div", ".a { width: 10px / 2; }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["arith-02-string-concat", "$a: \"foo\";\n.a { content: $a + \"bar\"; }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["arith-03-unit-mismatch", ".a { width: 1rem + 2px; }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["arith-04-mul", ".a { width: 10px * 2; }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["arith-05-var-mul", "$x: 10px;\n.a { width: $x * 2; }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["arith-06-add-vars", "$a: 1px;\n$b: 2px;\n.a { width: $a + $b; }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["arith-07-unitless-add", "$n: 1;\n.a { z-index: $n + 1; }", { error: "UXD_SCSS_UNSUPPORTED" }],
  ["sass-tol-01-responsive-fn", ".a { padding: xs(1px) md(2px); }", { css: ".a { padding: 1px; }@media (min-width: 768px) {.a { padding: 2px; } }" }],
  ["sass-tol-02-palette-dot", ".a { color: palette(primary.main); }", { css: ".a { color: var(--uxdsl__palette__primary-main); }" }],
  ["sass-tol-03-palette-plain", ".a { color: palette(primary); }", { css: ".a { color: var(--uxdsl__palette__primary-main); }" }],
  ["sass-tol-04-density", ".a { gap: density(2); }", { css: ".a { gap: var(--uxdsl__density__2); }" }],
  ["sass-tol-05-ds-surface", ".a { @ds-surface(contained); }", { css: ".a { padding: var(--uxdsl__surface__contained-padding); border-radius: var(--uxdsl__surface__contained-radius); background: var(--uxdsl__surface__contained-bg); color: var(--uxdsl__surface__contained-color); border: var(--uxdsl__surface__contained-border); box-shadow: var(--uxdsl__surface__contained-shadow); }" }],
  ["sass-tol-06-ds-button-args", ".a { @ds-button(contained primary 2); }", { css: ".a { padding: var(--uxdsl__density__2); border-radius: var(--uxdsl__radius__2); background: var(--uxdsl__palette__primary-main); color: var(--uxdsl__palette__primary-contrast); border: var(--uxdsl__surface__contained-border); box-shadow: var(--uxdsl__surface__contained-shadow); --uxdsl__button__tone-main: var(--uxdsl__palette__primary-main); --uxdsl__button__tone-dark: var(--uxdsl__palette__primary-dark); --uxdsl__button__tone-contrast: var(--uxdsl__palette__primary-contrast); } .a:hover:not(:where(:disabled, [aria-disabled=\"true\"])) { background: var(--uxdsl__button__contained-tone-primary-hover-bg, var(--uxdsl__button__contained-hover-bg)); color: var(--uxdsl__button__contained-tone-primary-hover-color, var(--uxdsl__button__contained-hover-color)); } .a:focus-visible { outline: var(--uxdsl__button__contained-tone-primary-focusvisible-outline, var(--uxdsl__button__contained-focusvisible-outline)); outline-offset: var(--uxdsl__button__contained-tone-primary-focusvisible-outline-offset, var(--uxdsl__button__contained-focusvisible-outline-offset)); } .a.is-selected, .a[aria-pressed=\"true\"], .a[aria-selected=\"true\"] { background: var(--uxdsl__button__contained-tone-primary-selected-bg, var(--uxdsl__button__contained-selected-bg)); color: var(--uxdsl__button__contained-tone-primary-selected-color, var(--uxdsl__button__contained-selected-color)); } .a:disabled, .a[aria-disabled=\"true\"] { opacity: var(--uxdsl__button__contained-tone-primary-disabled-opacity, var(--uxdsl__button__contained-disabled-opacity)); cursor: var(--uxdsl__button__contained-tone-primary-disabled-cursor, var(--uxdsl__button__contained-disabled-cursor)); }" }],
  ["sass-tol-07-ds-typo", ".a { @ds-typo(h1); }", { css: ".a { font-family: var(--uxdsl__typography__h1-font-family); font-size: var(--uxdsl__typography__h1-font-size); line-height: var(--uxdsl__typography__h1-line-height); font-weight: var(--uxdsl__typography__h1-font-weight); letter-spacing: var(--uxdsl__typography__h1-letter-spacing); margin-block-start: var(--uxdsl__typography__h1-margin-block-start); margin-block-end: var(--uxdsl__typography__h1-margin-block-end); }" }],
  ["sass-tol-08-responsive-space", ".a { padding: xs(space(1)) md(space(2)); }", { css: ".a { padding: var(--uxdsl__space__1); }@media (min-width: 768px) {.a { padding: var(--uxdsl__space__2); } }" }],
  ["sass-tol-09-radius-keyword", ".a { border-radius: radius(pill); }", { css: ".a { border-radius: 9999px; }" }],
];

const tally = { ok: 0, error: 0 };
for (const [name, source, expected] of CASES) {
  test(`scss subset: ${name}`, async () => {
    const entry = path.join(dir, `${name}.uxdsl`);
    fs.writeFileSync(entry, source + '\n');
    let result;
    try { result = await core.compile({ entry }, { includeTheme: false }); } catch (error) {
      assert.ok(expected.error, `expected output, got an error: ${error.message.split('\n')[0]}`);
      assert.ok(error.message.includes(expected.error), `expected ${expected.error}, got: ${error.message.split('\n')[0]}`);
      assert.ok(/:\d+:\d+:/.test(error.message) || typeof error.line === 'number', 'the error is located');
      tally.error++;
      return;
    }
    assert.ok(expected.css !== undefined, `expected an error ${expected.error}, but it compiled to: ${normalize(result.css)}`);
    assert.equal(normalize(result.css), expected.css);
    assert.deepEqual(problemsOf(result.css, expected), [], 'the output is valid CSS with no Sass construct left');
    tally.ok++;
  });
}

test('scss subset: the matrix is the audit\'s, and no case is silent', () => {
  assert.equal(CASES.length, 110);
  assert.equal(tally.ok + tally.error, 110, 'every case ran');
  assert.ok(tally.ok >= 68 && tally.error >= 41, `ok ${tally.ok}, error ${tally.error}`);
});

test('scss subset: an @include argument list that does not balance, or text after it, is UXD_INCLUDE_ARGUMENT, located', async () => {
  // (An unclosed parenthesis never gets this far: the SCSS parser reports it as an unclosed block.)
  for (const [include, reason] of [['@include pad(1px), 2px);', /has unbalanced parentheses/], ['@include pad(1px) 2px;', /has text after its argument list/]]) {
    const entry = path.join(dir, 'include-unbalanced.uxdsl');
    fs.writeFileSync(entry, `@mixin pad($p) { padding: $p; }\n.a {\n  ${include}\n}\n`);
    await assert.rejects(() => core.compile({ entry }, { includeTheme: false }), (error) => {
      assert.match(error.message, /UXD_INCLUDE_ARGUMENT: @include pad\(1px\)/);
      assert.match(error.message, reason);
      assert.match(error.message, /include-unbalanced\.uxdsl:3:3/);
      return true;
    });
  }
});
