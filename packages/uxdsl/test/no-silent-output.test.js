'use strict';

// Stability phase 3 (audit findings L1, L2, L3, L18, L19; "no silent output"):
// every way a responsive expression used to reach CSS as invalid text, or
// leave an empty rule behind, is a located error — or, for a rule the split
// emptied, simply gone. And Sass reaching the plugin alone is a located
// UXD_SASS_CONTEXT, never CSS a browser drops.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const postcss = require('postcss');

const exported = require('../dist/plugin');
const plugin = exported.default || exported;
const { analyzeResponsiveValue } = require('../dist/language');

const compile = (source, options = {}) => postcss([plugin({ discoverTheme: false, includeTheme: false, ...options })]).process(source, { from: '/project/src/app.uxdsl' }).css;
function failure(source, options) {
  try { compile(source, options); } catch (error) { return error; }
  return assert.fail(`expected ${JSON.stringify(source)} to fail, but it compiled`);
}
function errorOf(source, options) {
  const error = failure(source, options);
  assert.equal(error.name, 'CssSyntaxError', `${source}: ${error.message}`);
  assert.equal(error.file, '/project/src/app.uxdsl');
  return [error.reason.match(/^(UXD_[A-Z_]+):/)?.[1], error.reason, error];
}

test('a breakpoint function nested inside another function is UXD_BREAKPOINT_CONTEXT, with the top-level form to write', () => {
  for (const [source, mention] of [
    ['.a { width: calc(100% - xs(1rem) md(2rem)); }', 'xs(calc(100% - 1rem)) md(calc(100% - 2rem))'],
    ['.a { color: var(--x, xs(red) md(blue)); }', 'xs(var(--x, red)) md(var(--x, blue))'],
    ['.a { padding: xs(md(1rem)); }', 'xs('],
    ['.a { margin: clamp(1rem, xs(2vw) lg(3vw), 3rem); }', 'xs('],
  ]) {
    const [code, reason, error] = errorOf(source);
    assert.equal(code, 'UXD_BREAKPOINT_CONTEXT', reason);
    assert.ok(reason.includes(mention), `${reason} should mention ${mention}`);
    assert.equal(error.line, 1);
  }
  // The top-level form compiles to the two media blocks.
  assert.equal(compile('.a { width: xs(calc(100% - 1rem)) md(calc(100% - 2rem)); }'),
    '.a { width: calc(100% - 1rem); }@media (min-width: 768px) {.a { width: calc(100% - 2rem); } }');
});

for (const atRule of ['@keyframes pulse', '@-webkit-keyframes pulse', '@font-face', '@page :first', '@counter-style thumbs']) {
  test(`a responsive value under ${atRule.split(' ')[0]} is UXD_BREAKPOINT_CONTEXT (a media query cannot live there)`, () => {
    const inner = atRule.startsWith('@keyframes') || atRule.startsWith('@-webkit') ? 'from { padding: xs(1rem) md(2rem); }' : 'font-size: xs(1rem) md(2rem);';
    const [code, reason] = errorOf(`${atRule} { ${inner} }`);
    assert.equal(code, 'UXD_BREAKPOINT_CONTEXT', reason);
    assert.ok(reason.includes(atRule.split(' ')[0]), reason);
  });
}

test('tokens inside @keyframes and @font-face still compile; only responsive expressions are refused there', () => {
  assert.equal(compile('@keyframes pulse { from { padding: space(1); } to { padding: space(2); } }'),
    '@keyframes pulse { from { padding: var(--uxdsl__space__1); } to { padding: var(--uxdsl__space__2); } }');
  assert.match(compile('@font-face { font-family: "X"; src: url(x.woff2); }'), /@font-face \{ font-family: "X"; src: url\(x\.woff2\); \}/);
});

test('an empty breakpoint argument is UXD_BREAKPOINT_EMPTY', () => {
  for (const source of ['.a { padding: xs(); }', '.a { padding: xs( ) md(2rem); }', '.a { padding: xs(1rem) md(); }']) {
    const [code, reason] = errorOf(source);
    assert.equal(code, 'UXD_BREAKPOINT_EMPTY', reason);
    assert.match(reason, /xs\(\)|md\(\)/);
  }
});

test('a rule the responsive split emptied is removed; a rule with other declarations keeps them', () => {
  assert.equal(compile('.a { padding: md(2rem); }'), '@media (min-width: 768px) {.a { padding: 2rem; } }');
  assert.equal(compile('.a { color: red; padding: md(2rem); }'), '.a { color: red; }@media (min-width: 768px) {.a { padding: 2rem; } }');
  assert.equal(compile('.a { padding: md(2rem); margin: lg(1rem); }'), '@media (min-width: 768px) {.a { padding: 2rem; } }@media (min-width: 1024px) {.a { margin: 1rem; } }');
  // An empty rule the author wrote stays: nothing was removed from it.
  assert.equal(compile('.a {}'), '.a {}');
  // Nested in a conditional at-rule, the same.
  assert.equal(compile('@supports (display: grid) { .a { gap: md(1rem); } }'), '@supports (display: grid) { @media (min-width: 768px) { .a { gap: 1rem; } } }');
});

test('in a multi-part value every responsive group needs a base: UXD_BREAKPOINT_BASE', () => {
  for (const [source, mention] of [
    ['.a { padding: xs(1px) 5px md(2px); }', 'md(2px)'],
    ['.a { padding: 5px md(2px); }', 'md(2px)'],
    ['.a { margin: lg(1rem) auto; }', 'lg(1rem)'],
  ]) {
    const [code, reason] = errorOf(source);
    assert.equal(code, 'UXD_BREAKPOINT_BASE', reason);
    assert.ok(reason.includes(mention), reason);
    assert.match(reason, /xs\(/, 'the message says which breakpoint is the base');
  }
  // A lone group may start at any breakpoint; several groups each with a base are fine.
  assert.equal(compile('.a { padding: xs(1px) md(2px) 5px; }'), '.a { padding: 1px 5px; }@media (min-width: 768px) {.a { padding: 2px 5px; } }');
  assert.equal(compile('.a { padding: xs(1px) md(2px) xs(0) md(4px); }'), '.a { padding: 1px 0; }@media (min-width: 768px) {.a { padding: 2px 4px; } }');
});

test('!important inside a breakpoint group is UXD_BREAKPOINT_IMPORTANT; after the groups it applies at every breakpoint', () => {
  const [code, reason] = errorOf('.a { padding: xs(1px !important) md(2px); }');
  assert.equal(code, 'UXD_BREAKPOINT_IMPORTANT', reason);
  assert.ok(reason.includes('xs(1px) md(2px) !important'), reason);
  assert.equal(compile('.a { padding: xs(1px) md(2px) !important; }'), '.a { padding: 1px !important; }@media (min-width: 768px) {.a { padding: 2px !important; } }');
});

// --- Sass reaching the plugin alone ---------------------------------------------
// The plugin compiles CSS plus UXDSL; Dart Sass runs only inside compile() (uxdsl
// build and the adapters). Every Sass construct that reaches the plugin is a
// located UXD_SASS_CONTEXT naming the fix, and a $variable Dart Sass keeps as
// written gets the fix Sass needs.

const pipeline = require('../dist/entries/index.js').compile;
const sass = require('sass');

const sassContext = (construct) => `UXD_SASS_CONTEXT: ${construct} is Sass; the PostCSS plugin compiles CSS plus UXDSL. Name the file .uxdsl and compile it with uxdsl build, compile() or an adapter, or remove the Sass.`;
const keptBySass = (construct, where) => `UXD_SASS_CONTEXT: Sass keeps ${construct} literally in ${where}; write #{${construct}} (in a .uxdsl file compiled by uxdsl build, compile() or an adapter).`;
/** The 1-based line and column of the first occurrence of `word` in `source`. */
function positionOf(source, word) {
  const lines = source.split('\n');
  const index = lines.findIndex((line) => line.includes(word));
  return [index + 1, lines[index].indexOf(word) + 1];
}
const temporaryDirectory = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-sass-context-')));

test('MIG-B9-13: a $variable reaching the plugin alone is UXD_SASS_CONTEXT, located', () => {
  for (const source of [
    '$gap: 4px;\n.a {\n  width: $gap;\n}',
    '.a {\n  width: $gap;\n}',
    '.a {\n  $gap: 1px;\n  width: $gap;\n}',
  ]) {
    const [code, reason, error] = errorOf(source);
    assert.equal(code, 'UXD_SASS_CONTEXT', reason);
    assert.equal(reason, sassContext('$gap'));
    assert.deepEqual([error.line, error.column], positionOf(source, '$gap'), source);
  }
  // A dollar inside a string, or before a digit, is not a variable.
  assert.equal(compile('.a::before { content: "$5"; }'), '.a::before { content: "$5"; }');
  assert.equal(compile('.a { --price: $5; }'), '.a { --price: $5; }');
});

test('MIG-B9-13: every Sass construct fails alone as UXD_SASS_CONTEXT at the construct, naming it and the fix', () => {
  for (const [source, construct, word = construct] of [
    ['.a {\n  margin: m.$gap;\n}', 'm.$gap'],
    ['.a {\n  margin: -$gap;\n}', '$gap'],
    ['.a {\n  color: $-private;\n}', '$-private'],
    ['@use "sass:math";', '@use'],
    ['@forward "./tokens";', '@forward'],
    ['@mixin pad($p) {\n  padding: $p;\n}', '@mixin'],
    ['.a {\n  @include pad(1px);\n}', '@include'],
    ['@function double($n) {\n  @return $n * 2;\n}', '@function'],
    ['.a {\n  @return 1px;\n}', '@return'],
    ['.a {\n  @extend %base;\n}', '@extend'],
    ['.a {\n  @if $wide { width: 100%; }\n}', '@if'],
    ['@each $tone in primary, secondary {\n  .x { color: red; }\n}', '@each'],
    ['@for $i from 1 through 3 {\n  .w { width: 1px; }\n}', '@for'],
    ['@while $i < 3 {\n  .w { width: 1px; }\n}', '@while'],
    ['.a {\n  @at-root .b { color: red; }\n}', '@at-root'],
    ['.a {\n  @content;\n}', '@content'],
    ['@debug "x";', '@debug'],
    ['@warn "x";', '@warn'],
    ['@error "x";', '@error'],
    ['.a {\n  width: calc(#{$w} + 1px);\n}', '#{$w}', '#{'],
    ['@media (min-width: #{$bp}) {\n  .a { color: red; }\n}', '#{$bp}', '#{'],
    ['.a {\n  background: url(#{$base}/x.png);\n}', '#{$base}', '#{'],
    ['.a {\n  &__title { color: red; }\n}', '&__title'],
    ['.a {\n  &-x { color: red; }\n}', '&-x'],
    ['.a {\n  &--m { color: red; }\n}', '&--m'],
    ['%base {\n  color: red;\n}', '%base'],
    ['.a, %b {\n  color: red;\n}', '%b'],
    ['.a {\n  width: math.div(10px, 2);\n}', 'math.div(10px, 2)', 'math.div'],
    ['// top\n.a {\n  color: red;\n}', 'a // comment', '//'],
    ['.a {\n  font: {\n    family: x;\n    size: 2px;\n  }\n}', 'the nested property font:', 'font'],
    ['.a {\n  margin: 1px {\n    top: 2px;\n  }\n}', 'the nested property margin:', 'margin'],
    ['.a {\n  margin:-1px {\n    top: 2px;\n  }\n}', 'the nested property margin:', 'margin'],
    ['.a {\n  @media screen {\n    font : {\n      family: x;\n    }\n  }\n}', 'the nested property font:', 'font'],
    ['@layer base {\n  font: {\n    family: x;\n  }\n}', 'the nested property font:', 'font'],
  ]) {
    const [code, reason, error] = errorOf(source);
    assert.equal(code, 'UXD_SASS_CONTEXT', `${source}: ${reason}`);
    assert.equal(reason, sassContext(construct), source);
    assert.deepEqual([error.line, error.column], positionOf(source, word), source);
  }
});

test('MIG-B9-13: a $variable Sass keeps literally gets the kept message, from the plugin alone and through compile()', async () => {
  for (const [source, construct, where] of [
    ['.card {\n  --gap: $gap;\n}', '$gap', 'the custom property --gap'],
    ['@container card (min-width: $bp) {\n  .a { color: red; }\n}', '$bp', 'the @container prelude'],
  ]) {
    const [code, reason, error] = errorOf(source);
    assert.equal(code, 'UXD_SASS_CONTEXT', reason);
    assert.equal(reason, keptBySass(construct, where));
    assert.deepEqual([error.line, error.column], positionOf(source, construct), source);
  }
  // Through compile() Dart Sass keeps the same text, the plugin reports it, and
  // the position is the author's: the declaration or at-rule start Sass mapped.
  const from = path.join(temporaryDirectory(), 'y.uxdsl');
  for (const [source, construct, where, line, column] of [
    ['$gap: 4px;\n.card {\n  --gap: $gap;\n}\n', '$gap', 'the custom property --gap', 3, 3],
    ['$bp: 400px;\n@container card (min-width: $bp) {\n  .a { color: red; }\n}\n', '$bp', 'the @container prelude', 2, 1],
  ]) {
    const error = await pipeline({ source, from }, { theme: {}, includeTheme: false }).then(() => assert.fail(`expected ${JSON.stringify(source)} to fail`), (caught) => caught);
    assert.equal(error.name, 'CssSyntaxError', error.message);
    assert.equal(error.reason, keptBySass(construct, where));
    assert.deepEqual([error.file, error.line, error.column], [from, line, column]);
    assert.equal(error.message, `uxdsl: ${from}:${line}:${column}: ${keptBySass(construct, where)}`);
  }
});

const LOOK_ALIKES = [
  // CSS nesting and selectors
  '.a { &:hover { b: c; } & .x { b: c; } &.y { b: c; } .z & { b: c; } & + & { b: c; } &[data-x] { b: c; } &::before { b: c; } :is(&) { b: c; } && { b: c; } &#id { b: c; } &:not(&) { b: c; } > & { b: c; } }',
  // nested selectors with a pseudo-class, which Dart Sass reads as selectors, not as nested properties
  '.a { a:hover { b: c; } a :hover { b: c; } input:checked + label { b: c; } li:nth-child(2n + 1) { b: c; } a:not(.b) { b: c; } a::before { b: c; } a:-webkit-autofill { b: c; } a:\\68 over { b: c; } }',
  '@keyframes k { 0% { a: b; } 50% { a: b; } 12.5% { a: b; } to { a: b; } }', '.a[data-x="a&b"] { b: c; }', '.a[data-x="50%a"] { b: c; }', '.a[data-x=\'#{x}\'] { b: c; }', 'a[href^="//"] { b: c; }',
  // escaped selectors (Tailwind and hand-written)
  '.\\[\\&_p\\]\\:mt-4 p { b: c; }', '.a\\&b { b: c; }', '.w-\\[50\\%\\] { b: c; }', '.\\%x { b: c; }', '.\\$price { b: c; }', '.group-\\[\\&\\:hover\\]\\:x { b: c; }', '.\\26 x { b: c; }', '.sm\\:hover\\:bg-red:hover { b: c; }', '.\\/\\/x { b: c; }',
  // values
  '.a::before { content: "$5"; content: "#{x}"; content: \'$t\'; content: "a // b"; }', '.a { background: url($img); background: url("a$b.png"); background: url(//cdn/x.png); }', '.a { --price: $5; --x: 1px; --y: a$b; --z: "$v"; }',
  '.a { color: if(style(--x: 1): red; else: blue); }', '.a { width: calc(100% / 3); margin: 1.5em .5em; font: 12px/1.5 a, b; }', '.a { transform: translate(-.5rem, .25rem); opacity: .5; }', '.a { grid-template-areas: "a b" "c d"; grid-area: 1 / 1; }',
  '.a { filter: progid:DXImageTransform.Microsoft.gradient(startColorstr=\'#80000000\'); }', '.a { filter: progid:DXImageTransform.Microsoft.Alpha(Opacity=80); }',
  // at-rules
  '@function --double(--n) { result: calc(var(--n) * 2); }', '@mixin --m() { color: red; }', '.a { @apply --m; }', '@when media(width >= 400px) { .a { b: c; } } @else { .a { b: d; } }',
  '@property --x { syntax: "<length>"; inherits: false; initial-value: 0px; }', '@layer base, comps;', '@container card (min-width: 400px) { .a { b: c; } }', '@scope (.card) to (.content) { img { b: c; } }', '@starting-style { .a { opacity: 0; } }',
  '@position-try --x { top: anchor(bottom); }', '@view-transition { navigation: auto; }', '::view-transition-old(*) { b: c; }', '@namespace svg url(http://www.w3.org/2000/svg);', '@import url("t.css") layer(theme) supports(display: grid) screen;',
  '@font-feature-values Font One { @styleset { nice: 12; } }', '@counter-style thumbs { system: cyclic; symbols: "*"; }', '@page :first { margin: 1cm; @top-left { content: "x"; } }', '@font-palette-values --p { font-family: Bixa; }',
  '@supports selector(&) { .a { b: c; } }', '@media (400px <= width <= 700px) { .a { b: c; } }', '@custom-media --md (min-width: 768px);', '@custom-selector :--heading h1, h2;',
  // Tailwind v4's plain-CSS at-rules
  '@import "tailwindcss";', '@utility tab-4 { tab-size: 4; }', '@variant dark { .a { b: c; } }', '@custom-variant dark (&:where(.dark, .dark *));', '@source "../node_modules/x";', '@plugin "x";', '@config "./t.js";', '.a { @apply bg-red-500 hover:bg-red-700; }', '@tailwind base;', '@reference "../app.css";',
  // comments
  '/* $x #{y} &__z %p @include // */ .a { b: c; }',
];

// The constructs of the test above, as valid Sass.
const SASS_SOURCE = [
  '@use "sass:math";',
  '@forward "./tokens";',
  '$gap: 4px;',
  '$-private: 2px;',
  '$i: 0;',
  '@mixin pad($p) {',
  '  padding: $p;',
  '  @content;',
  '}',
  '@function double($n) {',
  '  @return $n * 2;',
  '}',
  '%base {',
  '  color: red;',
  '}',
  '// a Sass comment',
  '.a {',
  '  @extend %base;',
  '  margin: -$gap double(1px) $-private;',
  '  width: math.div(10px, 2);',
  '  @include pad(1px) { color: blue; }',
  '  @if $gap { height: 1px; }',
  '  &__title { color: red; }',
  '  &-x { color: red; }',
  '  &--m { color: red; }',
  '  @at-root .b { color: red; }',
  '  min-width: calc(#{$gap} + 1px);',
  '  background: url(#{$gap}/x.png);',
  '}',
  '.n {',
  '  font: {',
  '    family: x;',
  '    size: 2px;',
  '  }',
  '  margin: 1px {',
  '    top: 2px;',
  '  }',
  '}',
  '@each $tone in primary, secondary {',
  '  .x-#{$tone} { color: red; }',
  '}',
  '@for $n from 1 through 2 {',
  '  .w-#{$n} { width: 1px; }',
  '}',
  '@while $i < 1 {',
  '  .v { width: 1px; }',
  '  $i: $i + 1;',
  '}',
  '@media (min-width: #{$gap}) {',
  '  .m { color: red; }',
  '}',
  '@debug "x";',
  '',
].join('\n');

test('MIG-B9-13: CSS that looks like Sass passes the plugin alone unchanged, and the Sass compiles through compile() (negative control)', async () => {
  for (const source of LOOK_ALIKES) assert.equal(compile(source), source, source);
  const dir = temporaryDirectory();
  fs.writeFileSync(path.join(dir, '_tokens.uxdsl'), '$forwarded: 2px;\n.forwarded { width: $forwarded; }\n');
  const { css } = await pipeline({ source: SASS_SOURCE, from: path.join(dir, 'all.uxdsl') }, { theme: {}, includeTheme: false });
  for (const expected of [
    '.forwarded {\n  width: 2px;\n}',
    '.a {\n  color: red;\n}',
    '.a {\n  margin: -4px 2px 2px;\n  width: 5px;\n  padding: 1px;\n  color: blue;\n  height: 1px;\n}',
    '.a__title {', '.a-x {', '.a--m {', '.b {',
    '.a {\n  min-width: calc(4px + 1px);\n  background: url(4px/x.png);\n}',
    '.n {\n  font-family: x;\n  font-size: 2px;\n  margin: 1px;\n  margin-top: 2px;\n}',
    '.x-primary {', '.x-secondary {', '.w-1 {', '.w-2 {', '.v {', '@media (min-width: 4px) {\n  .m {',
  ]) {
    assert.ok(css.includes(expected), `${expected} in\n${css}`);
  }
  assert.doesNotMatch(css, /\$|#\{|@(use|forward|mixin|include|function|return|extend|if|each|for|while|at-root|content|debug)\b|\/\/|%base/);
  // Interpolation is how a $variable reaches a custom property.
  const custom = await pipeline({ source: '$gap: 4px;\n.card {\n  --gap: #{$gap};\n}\n', from: path.join(dir, 'z.uxdsl') }, { theme: {}, includeTheme: false });
  assert.equal(custom.css, '.card {\n  --gap: 4px;\n}');
});

// Where Dart Sass keeps a $variable as written (a custom property, the prelude
// of a plain-CSS at-rule it does not evaluate, a progid: value, a CSS @function
// body), the message is the kept one; everywhere else Sass evaluates it.
const KEPT_PROBES = [
  '@media (min-width: $v) { .a { b: c; } }', '@supports (width: $v) { .a { b: c; } }', '@supports (--x: $v) { .a { b: c; } }',
  '@supports selector(.a-$v) { .a { b: c; } }', '@container card (min-width: $v) { .a { b: c; } }', '@layer $v { .a { b: c; } }',
  '@layer a, $v;', '@scope (.a-$v) { .b { c: d; } }', '@custom-media --md (min-width: $v);', '@keyframes $v { from { a: b; } }',
  '@counter-style $v { system: cyclic; }', '@property $v { syntax: "<length>"; inherits: false; initial-value: 0px; }', '@page $v { margin: 1cm; }',
  '@font-feature-values $v { @styleset { nice: 1; } }', '@namespace $v url(x);', '@foo bar $v;', '@foo $v { .a { b: c; } }',
  '@import "x.css" screen and (min-width: $v);', '@import "x.css" supports(width: $v);', '@import "x.css" layer($v);',
  '.a { --x: $v; }', '.a { --x: calc($v + 1px); }', '.a { filter: progid:DXImageTransform.Microsoft.gradient(startColorstr=$v); }',
  '.a { color: var(--x, $v); }', '@function --double(--x) { result: $v; }', '.a { width: $v; }', '@page { margin: $v; }',
];

/** The plugin alone's verdict on a probe: 'kept', 'generic', 'none' (it compiled) or the other error it threw. */
function pluginVerdict(probe) {
  try {
    compile(probe);
    return 'none';
  } catch (error) {
    const reason = String(error.reason || error.message);
    if (reason.startsWith('UXD_SASS_CONTEXT: Sass keeps ')) return 'kept';
    if (reason.startsWith('UXD_SASS_CONTEXT: ')) return 'generic';
    return `other (${reason})`;
  }
}
/** The rows whose verdict is not "kept exactly where live Dart Sass keeps $v"; an undetected probe is one. */
function disagreements(rows) {
  const sassKeeps = (probe) => sass.compileString(`$v: 7px;\n${probe}`, { logger: sass.Logger.silent }).css.includes('$v');
  return rows
    .filter(({ probe, verdict }) => (verdict !== 'kept' && verdict !== 'generic') || (verdict === 'kept') !== sassKeeps(probe))
    .map(({ probe, verdict }) => `${verdict}: ${probe}`);
}

test('MIG-B9-13: the places where the kept message applies are where Dart Sass keeps a $variable literally (pinned against live Sass)', () => {
  assert.equal(KEPT_PROBES.length, 27);
  const rows = KEPT_PROBES.map((probe) => ({ probe, verdict: pluginVerdict(probe) }));
  assert.deepEqual(disagreements(rows), []);
  assert.ok(rows.some(({ verdict }) => verdict === 'kept') && rows.some(({ verdict }) => verdict === 'generic'), 'both verdicts occur');
});

test('MIG-B9-13: the kept-message comparison rejects a planted wrong row (negative control)', () => {
  assert.deepEqual(disagreements([{ probe: '.a { width: $v; }', verdict: 'kept' }]), ['kept: .a { width: $v; }']);
  assert.deepEqual(disagreements([{ probe: '.a { --x: $v; }', verdict: 'generic' }]), ['generic: .a { --x: $v; }']);
  assert.deepEqual(disagreements([{ probe: '.a { --x: $v; }', verdict: 'none' }]), ['none: .a { --x: $v; }']);
});

// Dart Sass reads a nested property where it reads declarations (inside a style rule, or an at-rule
// other than @media, @supports and @-moz-document): a name and a colon, then nothing, whitespace, or a
// value that does not start like an identifier. An identifier right after the colon is a selector.
const NESTED_PROBES = [
  '.a { font: { family: x; } }', '.a { font:{family:x} }', '.a { font : { family: x; } }', '.a { margin: 1px { top: 2px; } }',
  '.a { margin:-1px { top: 2px; } }', '.a { font:12px { family: x; } }', '.a { a: hover { color: red; } }', '.a { -webkit-box: { flex: 1; } }',
  '.a { @media screen { font: { family: x; } } }', '@layer base { font: { family: x; } }', '@font-face { font: { family: x; } }', '@foo { @media screen { font: { family: x; } } }',
  '.a { a:hover { color: red; } }', '.a { a :hover { color: red; } }', '.a { input:checked + label { color: red; } }', '.a { li:nth-child(2n + 1) { color: red; } }',
  '.a { a::before { color: red; } }', '.a { a:-webkit-autofill { color: red; } }', '.a { a:--state { color: red; } }', '.a { a:\\68 over { color: red; } }',
  '@media screen { font: { family: x; } }', '@supports (display: grid) { font: { family: x; } }',
];

/** Whether Dart Sass reads a nested property in `probe`: its output declares a property named after it (`font-family`, `margin-top`, `a-color`). A Sass error is not one. */
function sassNests(probe) {
  try {
    return /(^|[\s{;])[\w-]+-(family|top|color|flex)\s*:/m.test(sass.compileString(probe, { logger: sass.Logger.silent }).css);
  } catch {
    return false;
  }
}
/** The rows whose verdict (`flagged`: the plugin alone rejected the probe as a nested property) differs from live Dart Sass's reading. */
function nestingDisagreements(rows) {
  return rows.filter(({ probe, flagged }) => flagged !== sassNests(probe)).map(({ probe, flagged }) => `${flagged ? 'flagged' : 'passed'}: ${probe}`);
}

test('MIG-B9-13: the plugin alone rejects a nested property exactly where Dart Sass reads one (pinned against live Sass)', () => {
  const rows = NESTED_PROBES.map((probe) => {
    try {
      compile(probe);
      return { probe, flagged: false };
    } catch (error) {
      return { probe, flagged: String(error.reason).startsWith('UXD_SASS_CONTEXT: the nested property ') };
    }
  });
  assert.deepEqual(nestingDisagreements(rows), []);
  assert.ok(rows.some(({ flagged }) => flagged) && rows.some(({ flagged }) => !flagged), 'both verdicts occur');
  // UXDSL's removed @theme pack has the same shape, and keeps the diagnostic that says where its tokens go.
  assert.equal(errorOf('@theme { surface-contained: { bg: pink; } }')[0], 'UXD_THEME_BLOCK_REMOVED');
  assert.equal(errorOf('@theme { .a { font: { family: x; } } }')[0], 'UXD_THEME_BLOCK_REMOVED');
});

test('MIG-B9-13: the nested-property comparison rejects a planted wrong row (negative control)', () => {
  assert.deepEqual(nestingDisagreements([{ probe: '.a { a:hover { color: red; } }', flagged: true }]), ['flagged: .a { a:hover { color: red; } }']);
  assert.deepEqual(nestingDisagreements([{ probe: '.a { margin: 1px { top: 2px; } }', flagged: false }]), ['passed: .a { margin: 1px { top: 2px; } }']);
});

test('analyzeResponsiveValue describes groups, bases, nesting and empties for editors', () => {
  const bps = { xs: 0, md: 768, lg: 1024 };
  assert.deepEqual(analyzeResponsiveValue('xs(1px) md(2px) 5px', bps), { groups: [{ names: ['xs', 'md'], text: 'xs(1px) md(2px)', hasBase: true, empty: [], important: false }], standalone: false, nested: null });
  assert.deepEqual(analyzeResponsiveValue('md(2px)', bps), { groups: [{ names: ['md'], text: 'md(2px)', hasBase: false, empty: [], important: false }], standalone: true, nested: null });
  assert.deepEqual(analyzeResponsiveValue('calc(1px + xs(2px) md(3px))', bps).nested, { name: 'xs', parent: 'calc', names: ['xs', 'md'], inner: '1px + xs(2px) md(3px)' });
  assert.deepEqual(analyzeResponsiveValue('xs(md(2px))', bps).nested, { name: 'md', parent: 'xs', names: ['md'], inner: 'md(2px)' });
  assert.deepEqual(analyzeResponsiveValue('xs() md(1px !important)', bps).groups, [{ names: ['xs', 'md'], text: 'xs() md(1px !important)', hasBase: true, empty: ['xs'], important: true }]);
  assert.deepEqual(analyzeResponsiveValue('1px solid red', bps), { groups: [], standalone: false, nested: null });
});
