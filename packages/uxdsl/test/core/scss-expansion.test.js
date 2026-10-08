'use strict';

// The SCSS subset's expansion is UXDSL's own (src/scss-subset.ts,
// `scssSubset()`), replacing postcss-advanced-variables@3 — which pulled
// postcss@7 into every install. scss-subset.test.js pins the audit's 110-case
// matrix (byte-identical to the former output); these pin the expansion's own
// rules one by one, and the edges where it deliberately differs from the
// plugin it replaced (each listed in the CHANGELOG).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SourceMapConsumer } = require('source-map-js');
const { compile } = require('../../dist/entries/index.js');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-scss-expansion-'));
let counter = 0;
const normalize = (css) => css.replace(/\s+/g, ' ').trim();

async function css(source, options = {}) {
  const entry = path.join(dir, `case-${counter++}.uxdsl`);
  fs.writeFileSync(entry, source);
  return normalize((await compile({ entry }, { includeTheme: false, ...options })).css);
}

async function fails(source, pattern) {
  const entry = path.join(dir, `case-${counter++}.uxdsl`);
  fs.writeFileSync(entry, source);
  await assert.rejects(() => compile({ entry }, { includeTheme: false }), (error) => {
    assert.match(error.message, pattern);
    assert.match(error.message, new RegExp(`${path.basename(entry).replace('.', '\\.')}:\\d+:\\d+: `), 'located');
    return true;
  });
}

const branch = (condition) => `@if ${condition} { .a { x: then; } } @else { .a { x: else; } }`;

test('scope: a $variable belongs to the block that declares it and is seen by the blocks inside it', async () => {
  assert.equal(await css('$c: red;\n.a { $c: blue; color: $c; .b { color: $c; } }\n.c { color: $c; }'), '.a { color: blue; .b { color: blue; } } .c { color: red; }');
  // A later declaration at the same level replaces the earlier one from that point on.
  assert.equal(await css('$w: 1px;\n.a { width: $w; }\n$w: 2px;\n.b { width: $w; }'), '.a { width: 1px; } .b { width: 2px; }');
  await fails('.a { $local: 1px; }\n.b { width: $local; }', /UXD_SCSS_UNSUPPORTED: \$local is not defined where "\$local" uses it/);
  await fails('.a { width: $later; }\n$later: 1px;', /UXD_SCSS_UNSUPPORTED: \$later is not defined/);
});

test('!default sets a variable only when none is visible, from any enclosing block', async () => {
  assert.equal(await css('$x: 1px;\n$x: 2px !default;\n$y: 3px !default;\n.a { width: $x; height: $y; }'), '.a { width: 1px; height: 3px; }');
  assert.equal(await css('$x: 1px;\n.a { $x: 9px !default; width: $x; }'), '.a { width: 1px; }');
  assert.equal(await css('.a { $x: 9px !default; width: $x; }'), '.a { width: 9px; }');
});

test('interpolation: #{$var} in a selector, a value and an at-rule prelude; $var directly in a value and a prelude; never in a property name', async () => {
  assert.equal(await css('$n: card;\n$bp: 600px;\n.#{$n}-x { width: calc(100% - #{$bp}); }\n@media (min-width: $bp) { .#{$n} { c: d; } }'), '.card-x { width: calc(100% - 600px); } @media (min-width: 600px) { .card { c: d; } }');
  assert.equal(await css('$t: primary;\n.a { @ds-surface(contained $t); }').then((out) => out.includes('var(--uxdsl__palette__primary-main)')), true);
  await fails('$p: margin;\n.a { #{$p}-top: 1px; }', /UXD_SCSS_UNSUPPORTED: the interpolation in the property name/);
  // A backslash keeps a literal `$name`.
  assert.equal(await css('.a { content: "\\$price"; }'), '.a { content: "$price"; }');
});

test('nested mixins: a mixin includes another, and a mixin defined inside a block is local to it', async () => {
  assert.equal(await css('@mixin a($c) { color: $c; }\n@mixin b($c, $w: 1px) { @include a($c); border: $w solid $c; }\n.x { @include b(red); }\n.y { @include b(blue, 2px); }'), '.x { color: red; border: 1px solid red; } .y { color: blue; border: 2px solid blue; }');
  assert.equal(await css('.x { @mixin local { w: 1px; } @include local; }'), '.x { w: 1px; }');
  await fails('.x { @mixin local { w: 1px; } }\n.y { @include local; }', /UXD_SCSS_UNSUPPORTED: the mixin "local" is not defined where @include uses it/);
  // Token functions and responsive expressions are arguments as written, also through a second mixin.
  assert.equal(await css('@mixin pad($p) { padding: $p; }\n@mixin card($p) { @include pad($p); }\n.x { @include card(density(2)); }'), '.x { padding: var(--uxdsl__density__2); }');
});

test('arguments: positional, defaults (with parentheses), too many or a missing one is UXD_INCLUDE_ARGUMENT', async () => {
  assert.equal(await css('@mixin m($a, $b: rgba(0, 0, 0, .5)) { color: $b; width: $a; }\n.x { @include m(1px); }\n.y { @include m(2px, red); }'), '.x { color: rgba(0, 0, 0, .5); width: 1px; } .y { color: red; width: 2px; }');
  assert.equal(await css('@mixin m($a) { w: $a; }\n.x { @include m (1px); }'), '.x { w: 1px; }');
  await fails('@mixin m($a) { w: $a; }\n.x { @include m(1px, 2px); }', /UXD_INCLUDE_ARGUMENT: @include m\(1px, 2px\) passes 2 arguments; @mixin m takes 1\./);
  await fails('@mixin m($a) { w: $a; }\n.x { @include m; }', /UXD_INCLUDE_ARGUMENT: @include m is missing the argument \$a of @mixin m, which has no default\./);
  await fails('@mixin m($a: 1px) { w: $a; }\n.x { @include m($a: 2px); }', /UXD_SCSS_UNSUPPORTED: the keyword argument "\$a: 2px"/);
  await fails('@mixin m($list...) { w: $list; }', /UXD_SCSS_UNSUPPORTED: the variadic parameter \$list\.\.\./);
});

test('@content: the include\'s block, none when the include has no block, and no arguments', async () => {
  const mq = '@mixin mq { @media (min-width: 600px) { @content; } }\n';
  assert.equal(await css(`${mq}.a { @include mq { color: red; } }`), '.a { @media (min-width: 600px) { color: red; } }');
  assert.equal(await css('@mixin wrap { .in { @content; } w: 1px; }\n.a { @include wrap; }'), '.a { .in { } w: 1px; }');
  await fails(`${mq}.a { @include mq using ($x) { color: $x; } }`, /UXD_SCSS_UNSUPPORTED: @include … using \(content arguments\)/);
  await fails('@mixin m { @content(1px); }\n.a { @include m { w: 1px; } }', /UXD_SCSS_UNSUPPORTED: @content\(1px\)/);
  await fails('@mixin m { w: 1px; }\n.a { @include m { color: red; } }', /UXD_INCLUDE_ARGUMENT: @include m passes a content block, but @mixin m has no @content/);
  await fails('.a { @content; }', /UXD_SCSS_UNSUPPORTED: @content outside a @mixin/);
});

test('@each: one variable over a comma list, a space list, a $variable or a map (its values), with interpolation', async () => {
  assert.equal(await css('@each $t in primary, secondary { .t-#{$t} { color: palette(#{$t}.main); } }'), '.t-primary { color: var(--uxdsl__palette__primary-main); } .t-secondary { color: var(--uxdsl__palette__secondary-main); }');
  assert.equal(await css('@each $s in sm md lg { .x-#{$s} { c: d; } }'), '.x-sm { c: d; } .x-md { c: d; } .x-lg { c: d; }');
  assert.equal(await css('$l: (a, b);\n@each $x in $l { .x-#{$x} { c: d; } }'), '.x-a { c: d; } .x-b { c: d; }');
  assert.equal(await css('@each $v in (a: 1px, b: 2px) { .w { width: $v; } }'), '.w { width: 1px; } .w { width: 2px; }');
  assert.equal(await css('@each $x in () { .x { c: d; } }\n.k { c: d; }'), '.k { c: d; }');
  assert.equal(await css('@each $f in "Inter var", serif { .f { font-family: $f; } }'), '.f { font-family: "Inter var"; } .f { font-family: serif; }');
  await fails('@each $k, $v in (a: 1px) { .x { w: $v; } }', /UXD_SCSS_UNSUPPORTED: @each \$k, \$v in .*one variable/);
  await fails('@each $v $i in a, b { .x { w: $v; } }', /UXD_SCSS_UNSUPPORTED: @each \$v \$i in a, b/);
});

test('@for: from … through includes the end, from … to leaves it out, counting down works, bounds are whole numbers', async () => {
  assert.equal(await css('@for $i from 1 through 3 { .w-#{$i} { c: d; } }'), '.w-1 { c: d; } .w-2 { c: d; } .w-3 { c: d; }');
  assert.equal(await css('@for $i from 1 to 3 { .w-#{$i} { c: d; } }'), '.w-1 { c: d; } .w-2 { c: d; }');
  assert.equal(await css('$n: 3;\n@for $i from $n through 1 { .w-#{$i} { c: d; } }'), '.w-3 { c: d; } .w-2 { c: d; } .w-1 { c: d; }');
  assert.equal(await css('@for $i from 2 to 2 { .w { c: d; } }\n.k { c: d; }'), '.k { c: d; }');
  await fails('@for $i from 1 through 6 by 2 { .w { c: d; } }', /UXD_SCSS_UNSUPPORTED: @for \$i from 1 through 6 by 2/);
  await fails('@for $i from a through 3 { .w { c: d; } }', /UXD_SCSS_UNSUPPORTED: @for .*not whole numbers/);
});

test('@if truthiness is Sass\'s: false and null are false; 0, "", an empty list and any other value are true', async () => {
  for (const [condition, expected] of [['false', 'else'], ['null', 'else'], ['$f', 'else'], ['0', 'then'], ['""', 'then'], ['()', 'then'], ['true', 'then'], ['ocean', 'then']]) {
    assert.equal(await css(`$f: null;\n${branch(condition)}`), `.a { x: ${expected}; }`, `@if ${condition}`);
  }
  await fails('$e: "";\n@if  { .a { c: d; } }', /UXD_SCSS_UNSUPPORTED: @if without a condition/);
});

test('@if comparisons: == and != on values; ordering on numbers of one unit; and/or/not and @else if fail', async () => {
  assert.equal(await css(`$t: ocean;\n${branch('$t == ocean')}`), '.a { x: then; }');
  assert.equal(await css(`$i: 2;\n${branch('$i != 2')}`), '.a { x: else; }');
  assert.equal(await css(branch('($i == 0)').replace(/^/, '$i: 0;\n')), '.a { x: then; }');
  assert.equal(await css(branch('10px < 9px')), '.a { x: else; }');
  assert.equal(await css(branch('2 >= 1')), '.a { x: then; }');
  await fails(branch('a < b'), /UXD_SCSS_UNSUPPORTED: the comparison "a < b"/);
  await fails(branch('1px < 2rem'), /UXD_SCSS_UNSUPPORTED: the comparison "1px < 2rem"/);
  await fails(`$a: true;\n${branch('$a and $a')}`, /UXD_SCSS_UNSUPPORTED: the condition "\$a and \$a"/);
  await fails(`$a: true;\n${branch('not $a')}`, /UXD_SCSS_UNSUPPORTED: the condition "not \$a"/);
  await fails('@if false { .a { c: d; } } @else if true { .b { c: d; } }', /UXD_SCSS_UNSUPPORTED: @else if true .*write a second @if/);
  await fails('.a { c: d; }\n@else { .b { c: d; } }', /UXD_SCSS_UNSUPPORTED: @else that does not follow an @if/);
  // A comment between the @if block and its @else stays where it was.
  assert.equal(await css('@if false { .a { x: then; } } /* c */ @else { .a { x: else; } }'), '/* c */ .a { x: else; }');
});

test('@import inside a block, a control rule or a mixin fails; at the top it is postcss-import\'s, and a remote one stays', async () => {
  fs.writeFileSync(path.join(dir, 'plain.css'), '.p { color: blue; }\n');
  await fails('.a { @import "./plain.css"; }', /UXD_SCSS_UNSUPPORTED: @import inside a block, @if, @each, @for or @mixin/);
  await fails('@if true { @import "./plain.css"; }', /UXD_SCSS_UNSUPPORTED: @import inside a block/);
  assert.equal(await css('@import "./plain.css";\n.a { c: d; }'), '.p { color: blue; } .a { c: d; }');
  assert.equal(await css('@import url("https://example.com/x.css");\n.a { c: d; }'), '@import url("https://example.com/x.css"); .a { c: d; }');
});

test('source maps: a $variable\'s declaration maps to where it is used, a mixin\'s to the mixin body', async () => {
  const source = [
    '@mixin pad($p) {',
    '  padding: $p;',
    '}',
    '$c: red;',
    '.a {',
    '  color: $c;',
    '  @include pad(density(2));',
    '}',
    '',
  ].join('\n');
  const entry = path.join(dir, 'mapped.uxdsl');
  fs.writeFileSync(entry, source);
  const result = await compile({ entry }, { includeTheme: false, sourceMap: 'external', to: path.join(dir, 'mapped.css') });
  const consumer = new SourceMapConsumer(JSON.parse(result.map));
  const lines = result.css.split('\n');
  const positionOf = (needle) => {
    const line = lines.findIndex((l) => l.includes(needle));
    const original = consumer.originalPositionFor({ line: line + 1, column: lines[line].indexOf(needle) });
    return [path.basename(original.source), original.line, original.column];
  };
  assert.deepEqual(positionOf('color: red'), ['mapped.uxdsl', 6, 2]);
  assert.deepEqual(positionOf('padding: var(--uxdsl__density__2)'), ['mapped.uxdsl', 2, 2]);
});
