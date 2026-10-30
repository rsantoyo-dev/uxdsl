'use strict';

// MIG-B9-10 (FEAT-010) wrote the protect/restore cases; MIG-B9-11 implements
// src/sass/protect.ts and runs them end to end here with the `sass` package
// directly — protect → Dart Sass → restoreDirectiveSpacing → the UXDSL plugin —
// without compile(), which MIG-B9-13 puts on this pipeline. The unit tests of
// protect() itself (its rules R1–R8) are below the case loop.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const sass = require('sass');

const core = require('../../dist/entries/index.js');
const exported = require('../../dist/plugin');
const plugin = exported.default || exported;
const { protect, findShadowingFunctions, restoreDirectiveSpacing, TOKEN_FUNCTION_NAMES } = require('../../dist/sass/protect.js');
const { THEME, CASES } = require('./protect.cases.js');
const { CASES: MATRIX } = require('./sass-matrix.cases.js');

/** Whitespace-insensitive comparison: Sass's expanded layout and the plugin's own
 * formatting differ only in spacing around punctuation (Sass writes `r g b/0.5`
 * where the author wrote `r g b / 0.5`). */
const flat = (css) => css.replace(/\s+/g, ' ').replace(/\s*([{};,/])\s*/g, '$1').replace(/;}/g, '}').trim();

const codeOf = (error) => (/\b(UXD_[A-Z0-9_]+)\b/.exec(String(error && error.message)) || [])[1] || String(error);

/** The effective theme's breakpoint names: what a project `@function` may shadow besides the token functions and tone(). */
const RESERVED = Object.keys(core.resolveTheme(THEME).breakpoints);
const silentLogger = { warn() {}, debug() {} };
const uxdsl = () => plugin({ theme: THEME, includeTheme: false, discoverTheme: false });

/** What the UXDSL plugin alone (no Sass) makes of `source`: `{ css }` or `{ error }`. */
function oracle(source) {
  try {
    return { css: postcss([uxdsl()]).process(source, { from: undefined }).css };
  } catch (error) {
    return { error: codeOf(error) };
  }
}

/** The pipeline, with `protectFn` as its first stage and `restoreFn` on Sass's output: `{ css, warnings }` or `{ error }`. A Sass failure is reported as UXD_SASS, the code MIG-B9-12 gives it. */
function pipelineWith(protectFn, restoreFn, source) {
  const guarded = protectFn(source);
  let compiled;
  try {
    compiled = sass.compileString(guarded.code, { style: 'expanded', logger: silentLogger }).css;
  } catch (error) {
    return { error: 'UXD_SASS', message: error.message };
  }
  try {
    const css = postcss([restoreDirectiveSpacing, uxdsl()]).process(restoreFn(compiled), { from: undefined }).css;
    return { css, warnings: guarded.problems.map((problem) => problem.code) };
  } catch (error) {
    return { error: codeOf(error) };
  }
}

const pipeline = (source) => pipelineWith((text) => protect(text, { reserved: RESERVED, file: 'case.uxdsl' }), (css) => css, source);

/** One case against its expectation: returns null when it passes, the mismatch otherwise. */
function verdict(id, source, expected, options, run) {
  const actual = run(source);
  if (typeof expected === 'string' && expected.startsWith('ERROR:')) {
    const want = expected.slice('ERROR:'.length);
    return actual.error === want ? null : `${id} should fail with ${want}, got ${actual.error || 'CSS'}`;
  }
  const want = typeof expected === 'string' ? { css: expected } : oracle(expected.sameAs);
  if (want.error) return actual.error === want.error ? null : `${id} should fail like its plain-UXDSL form (${want.error}), got ${actual.error || 'CSS'}`;
  if (actual.error) return `${id} failed: ${actual.error}${actual.message ? ` — ${actual.message.split('\n')[0]}` : ''}`;
  if (flat(actual.css) !== flat(want.css)) return `${id}: expected ${flat(want.css)} got ${flat(actual.css)}`;
  if (options.warning && !actual.warnings.includes(options.warning)) return `${id} should warn ${options.warning}`;
  return null;
}

test('MIG-B9-10: the protect/restore list has the 63 cases of the story, with unique ids', () => {
  assert.equal(CASES.length, 63);
  assert.equal(new Set(CASES.map(([id]) => id)).size, 63);
  for (const [id, source, expected] of CASES) {
    assert.equal(typeof source, 'string', id);
    const shapeOk = typeof expected === 'string' || (expected && typeof expected.sameAs === 'string');
    assert.ok(shapeOk, `${id}: expectation is CSS, 'ERROR:<code>' or { sameAs }`);
  }
});

test('MIG-B9-10: every sameAs oracle is itself UXDSL without Sass (no $, #{ }, @use, @each, @mixin)', () => {
  for (const [id, , expected] of CASES) {
    if (typeof expected !== 'object') continue;
    assert.doesNotMatch(expected.sameAs, /\$[a-z]|#\{|@(use|each|mixin|include|function)\b/i, id);
  }
});

// --- T6: the 63 cases, end to end ---------------------------------------------

for (const [id, source, expected, options = {}] of CASES) {
  test(`MIG-B9-11: protect → Dart Sass → restore → plugin gives the expected CSS: ${id}`, () => {
    assert.equal(verdict(id, source, expected, options, pipeline), null);
  });
}

// The regex prototype of 2026-10-09 (docs/audits/2026-10-09-sass-layer/run.js),
// verbatim: it protected only lowercase dotted palette()/color() keys and `$var`
// inside directives, by regular expressions that read strings and comments as
// code. Three of the cases it got wrong are the control: the regex pipeline
// fails them, the tokenizer passes them.
const regexProtect = (s) => ({
  code: s
    .replace(/\b(palette|color)\(\s*([a-z][a-z0-9-]*\.[a-z0-9-]+)\s*(,[^)]*)?\)/g, (m, fn, key, rest) => `uxdsl-${fn}("${key}"${rest || ''})`)
    .replace(/(@ds-[a-z]+\s*\()([^)]*)\)/g, (m, head, args) => head + args.replace(/(^|[^{])\$([a-zA-Z_][\w-]*)/g, (mm, pre, name) => `${pre}#{$${name}}`) + ')'),
  problems: [],
});
const regexRestore = (s) => s.replace(/uxdsl-(palette|color)\("([^"]*)"(,[^)]*)?\)/g, (m, fn, key, rest) => `${fn}(${key}${rest || ''})`);
const regexPipeline = (source) => pipelineWith(regexProtect, regexRestore, source);

test('MIG-B9-11: protect → Dart Sass → restore → plugin (negative control): the regex prototype fails C3, K1 and K5; the tokenizer passes them', () => {
  const controls = ['C3', 'K1', 'K5'];
  for (const [id, source, expected, options = {}] of CASES.filter(([id]) => controls.includes(id))) {
    assert.notEqual(verdict(id, source, expected, options, regexPipeline), null, `${id} should fail under the regex prototype`);
    assert.equal(verdict(id, source, expected, options, pipeline), null);
  }
});

// --- T1: R1, token calls ----------------------------------------------------------

test('MIG-B9-11: protect rewrites a dotted token key, $var and ns.$var inside it, and extra arguments', () => {
  const run = (source) => protect(source, { reserved: RESERVED }).code;
  assert.equal(run('.a { color: palette(primary.main); }'), '.a { color: #{"palette(primary.main)"}; }');
  assert.equal(run('.a { color: palette($f.$v); }'), '.a { color: #{"palette(#{$f}.#{$v})"}; }');
  assert.equal(run('.a { color: palette(m.$f.main); }'), '.a { color: #{"palette(#{m.$f}.main)"}; }');
  assert.equal(run('.a { color: palette(#{$t}.main); }'), '.a { color: #{"palette(#{$t}.main)"}; }', 'an interpolation already there is kept');
  assert.equal(run('.a { color: palette(primary.main, 0.5); }'), '.a { color: #{"palette(primary.main, 0.5)"}; }', 'a bare number is kept as written');
  assert.equal(run('.a { color: palette(primary.main, .5); }'), '.a { color: #{"palette(primary.main, .5)"}; }');
  assert.equal(run('.a { color: palette(primary.main, $a); }'), '.a { color: #{"palette(primary.main, #{$a})"}; }', 'a variable argument is interpolated');
  assert.equal(run('.a { color: palette(primary.main, #{$a}); }'), '.a { color: #{"palette(primary.main, #{$a})"}; }', 'an interpolated argument is not wrapped twice');
  assert.equal(run('.a { color: palette(primary.main, math.div(1, 2)); }'), '.a { color: #{"palette(primary.main, #{math.div(1, 2)})"}; }', 'an expression argument is interpolated');
  // Every token function, case-insensitively, when the first argument is key-like.
  assert.equal(run('.a { padding: space(10-2) density(0-5) radius(pill) border(1) shadow(2-inset); color: color(Gray.900) PALETTE(primary); }'),
    '.a { padding: #{"space(10-2)"} #{"density(0-5)"} #{"radius(pill)"} #{"border(1)"} #{"shadow(2-inset)"}; color: #{"color(Gray.900)"} #{"PALETTE(primary)"}; }');
  assert.equal(run('.a { color: color(white); background: color(black, 0.5); }'), '.a { color: #{"color(white)"}; background: #{"color(black, 0.5)"}; }', 'Dart Sass >= 1.79 parses an unprotected color(white) as CSS Color 4 and fails');
  assert.equal(run('.a { padding: space($n); }'), '.a { padding: #{"space(#{$n})"}; }');
  assert.equal(run('.a { padding: space(#{$k}); }'), '.a { padding: #{"space(#{$k})"}; }');
  assert.equal(run('.a { padding: xs(space(2)) md(space(4)); width: calc(100% - space(4)); }'), '.a { padding: xs(#{"space(2)"}) md(#{"space(4)"}); width: calc(100% - #{"space(4)"}); }', 'nested in a breakpoint or CSS function');
  assert.equal(run('.a { padding: #{space(2)}; }'), '.a { padding: #{#{"space(2)"}}; }', 'inside an interpolation too (Dart Sass accepts nested interpolation)');
  // Not key-like: Sass's to evaluate, left as written.
  for (const source of [
    '.a { color: color(display-p3 1 0 0); }',
    '.a { color: color(srgb 1 0 0 / 0.5); }',
    '.a { padding: space(2 + 1); }',
    '.a { padding: space("2"); }',
    '.a { padding: space(); }',
    '.a { padding: space(2,); }',
    '.a { padding: space($a * 2); }',
    '.a { color: palette(map.get($m, a)); }',
  ]) assert.equal(run(source), source, source);
  assert.equal(run('.a { color: color(from palette(primary.main) srgb r g b / 0.5); }'), '.a { color: color(from #{"palette(primary.main)"} srgb r g b / 0.5); }', 'the relative-color form is left; the token inside it is protected');
  // Not a call: a class, a placeholder, a namespaced call, a property, a mixin.
  for (const source of [
    '.a:is(.space, .shadow) { color: red; }',
    '%shadow { color: blue; }',
    '.a { margin: helpers.space(2); }',
    '.a { color: red; border: 0; }',
    '@mixin border($w) { border: $w solid red; }\n.a { @include border(1px); }',
    '.a { -webkit-color(x): 1; }',
    '.a { &__shadow(x) { color: red; } }',
  ]) assert.equal(run(source), source, source);
  assert.deepEqual([...TOKEN_FUNCTION_NAMES].sort(), ['border', 'color', 'density', 'palette', 'radius', 'shadow', 'space']);
});

test('MIG-B9-11: protect rewrites a dotted token key (negative control): space(2) and palette(primary) are returned unchanged by Dart Sass', () => {
  // A key without a dot was the only unprotected form the first contract allowed;
  // protecting it changes nothing in what Sass emits, which is why the review
  // widened the rule to every key-like argument.
  for (const source of ['.a { padding: space(2); }', '.a { color: palette(primary); }']) {
    const guarded = protect(source, { reserved: RESERVED }).code;
    assert.notEqual(guarded, source);
    assert.equal(flat(sass.compileString(guarded, { style: 'expanded', logger: silentLogger }).css), flat(source));
    assert.equal(flat(sass.compileString(source, { style: 'expanded', logger: silentLogger }).css), flat(source));
  }
  // Whereas Sass evaluates the keys the rule now protects.
  assert.equal(flat(sass.compileString('.a { padding: space(10-2) space(0-5); }', { style: 'expanded' }).css), flat('.a { padding: space(8) space(-5); }'));
  assert.throws(() => sass.compileString('.a { color: color(white); }'), /white is not a string/);
  assert.throws(() => sass.compileString('.a { color: color(black, 0.5); }'), /Only 1 argument allowed/);
});

// --- T2: R2 and R3, directive arguments, never inside comments and strings -------

test('MIG-B9-11: protect substitutes $var inside @ds-*(…), case-insensitively, across lines, not inside #{} strings or comments', () => {
  const run = (source) => protect(source, { reserved: RESERVED }).code;
  assert.equal(run('.a { @ds-surface(contained $t $n); }'), '.a { @ds-surface(contained #{$t} #{$n}); }');
  assert.equal(run('.a { @DS-SURFACE(contained $t); }'), '.a { @DS-SURFACE(contained #{$t}); }');
  assert.equal(run('.a { @ds-surface (contained $t); }'), '.a { @ds-surface (contained #{$t}); }', 'whitespace before the parenthesis is allowed');
  assert.equal(run('.a { @ds-surface(contained m.$e); }'), '.a { @ds-surface(contained #{m.$e}); }');
  assert.equal(run('.a { @ds-surface(contained radius($r)); }'), '.a { @ds-surface(contained #{"radius(#{$r})"}); }', 'a token call inside the arguments follows R1');
  assert.equal(run('.a {\n  @ds-button(\n    contained\n    $t\n  );\n}'), '.a {\n  @ds-button(\n    contained\n    #{$t}\n  );\n}', 'parameters may span lines');
  assert.equal(run('.a { @ds-surface(contained #{$t} #{$n}); }'), '.a { @ds-surface(contained #{$t} #{$n}); }', 'already interpolated');
  assert.equal(run('.a { @ds-surface(contained "$t"); }'), '.a { @ds-surface(contained "$t"); }', 'a string is text');
  assert.equal(run('.a { @ds-surface(contained /* $t ) */ $u); }'), '.a { @ds-surface(contained /* $t ) */ #{$u}); }', 'a comment is text and its parenthesis does not count');
  assert.equal(run('.a { @ds-surface(outlined $tone /* ) */); }'), '.a { @ds-surface(outlined #{$tone} /* ) */); }');
  // Outside a directive, $var is Sass's.
  assert.equal(run('$gap: space(2);\n.a { gap: $gap; width: fn($x); }'), '$gap: #{"space(2)"};\n.a { gap: $gap; width: fn($x); }');
  // Never inside comments, strings or an unquoted url(), token calls included.
  for (const source of [
    '/* @ds-surface($x) */\n.a { color: red; }',
    '.a { color: red; /* palette(primary.main) */ }',
    '.a {\n  color: red; // palette(primary.main) @ds-surface($x)\n}',
    '.a { content: "palette(primary.main) @ds-surface($x)"; }',
    ".a { content: 'palette(primary.main)'; }",
    '.a { content: "say \\"palette(primary.main)\\""; }',
    '.a { background: url(img/palette(primary.main).png); }',
    '.a { background: url("space(2).png"); }',
    '.a { background: url(//cdn.example.com/x.png); }',
  ]) assert.equal(run(source), source, source);
  assert.equal(run('.a { content: "/*"; padding: space(2) /* ) */; }'), '.a { content: "/*"; padding: #{"space(2)"} /* ) */; }', 'a comment opener inside a string is text');
  assert.equal(run('.a { content: "#{palette(primary.main)}"; }'), '.a { content: "#{#{"palette(primary.main)"}}"; }', 'an interpolation inside a string is an expression');
});

// --- T3: R7, identity ----------------------------------------------------------------

test('MIG-B9-11: protect is the identity on every Sass-valid matrix case and on a 10 KB CSS sample', () => {
  const sassCases = MATRIX.filter(([, , , meta]) => meta && meta.group === 'sass');
  assert.ok(sassCases.length >= 70, `expected the 75 sass-group cases, found ${sassCases.length}`);
  for (const [name, source] of sassCases) {
    const result = protect(source, { reserved: RESERVED });
    assert.equal(result.code, source, name);
    assert.deepEqual(result.problems, [], name);
  }
  const sample = postcss([plugin({ theme: THEME, discoverTheme: false })]).process('@uxdsl theme;\n.a { color: red; }\n', { from: undefined }).css;
  assert.ok(Buffer.byteLength(sample) >= 10 * 1024, `the generated theme CSS is ${Buffer.byteLength(sample)} bytes`);
  assert.doesNotMatch(sample, /\b(space|density|color|palette|radius|border|shadow)\(/, 'the sample is compiled CSS with no token call left');
  assert.equal(protect(sample, { reserved: RESERVED }).code, sample);
});

test('MIG-B9-11: protect is the identity (negative control): a source with palette(x.y) changes', () => {
  const source = '.a { color: palette(x.y); }';
  assert.notEqual(protect(source, { reserved: RESERVED }).code, source);
  assert.notEqual(protect('.a { @ds-surface(contained $t); }', { reserved: RESERVED }).code, '.a { @ds-surface(contained $t); }');
});

// --- T4: DEC-17, a shadowing @function is a warning and the author's function wins -------

test('MIG-B9-11: @function space and @function md are UXD_FUNCTION_SHADOWED at their line and column; @mixin border is not', () => {
  const source = [
    '@use "sass:math";',
    '@function space($k) { @return $k * 3px; }',
    '.a { padding: space(2); color: palette(primary.main); }',
    '@function md($v) { @return $v; }',
    '.b { padding: md(2px); }',
    '@mixin border($w) { border: $w solid red; }',
    '.c { @include border(1px); border-radius: radius(2); }',
  ].join('\n');
  const result = protect(source, { reserved: RESERVED, file: 'entry.uxdsl' });
  assert.deepEqual(result.problems, [
    { code: 'UXD_FUNCTION_SHADOWED', message: "UXD_FUNCTION_SHADOWED: @function space (entry.uxdsl:2) replaces UXDSL's space() in this build; rename it to use the token", line: 2, column: 11, name: 'space' },
    { code: 'UXD_FUNCTION_SHADOWED', message: "UXD_FUNCTION_SHADOWED: @function md (entry.uxdsl:4) replaces UXDSL's md() in this build; rename it to use the token", line: 4, column: 11, name: 'md' },
  ]);
  // The call to the author's space() is left to Sass; every other token is protected.
  assert.equal(result.code.split('\n')[2], '.a { padding: space(2); color: #{"palette(primary.main)"}; }');
  assert.equal(result.code.split('\n')[6], '.c { @include border(1px); border-radius: #{"radius(2)"}; }');
  // Sass calls the author's function; the plugin resolves the rest.
  const css = postcss([restoreDirectiveSpacing, uxdsl()]).process(sass.compileString(result.code, { style: 'expanded', logger: silentLogger }).css, { from: undefined }).css;
  assert.equal(flat(css), flat('.a { padding: 6px; color: var(--uxdsl__palette__primary-main); } .b { padding: 2px; } .c { border: 1px solid red; border-radius: var(--uxdsl__radius__2); }'));
  // findShadowingFunctions is the same scan, for a file whose text is not rewritten (a .scss partial).
  assert.deepEqual(findShadowingFunctions(source, { reserved: RESERVED, file: 'entry.uxdsl' }), result.problems);
  assert.deepEqual(findShadowingFunctions('@function color($name) { @return map.get($colors, $name); }', { file: '_helpers.scss' }).map((p) => [p.name, p.line, p.column]), [['color', 1, 11]]);
  // Without a file the location is the line alone.
  assert.match(protect('@function tone($x) { @return $x; }').problems[0].message, /@function tone \(line 1\) replaces UXDSL's tone\(\)/);
  // `_` and `-` are the same character to Sass; a breakpoint written with a dash is shadowed by the underscore spelling.
  assert.deepEqual(protect('@function x_large($v) { @return $v; }', { reserved: ['x-large'] }).problems.map((p) => p.name), ['x-large']);
  // A name defined elsewhere in the build arrives through options.unprotected.
  assert.equal(protect('.a { margin: space(2); color: palette(primary.main); }', { unprotected: ['space'] }).code, '.a { margin: space(2); color: #{"palette(primary.main)"}; }');
});

test('MIG-B9-11: @function space is UXD_FUNCTION_SHADOWED (negative control): @mixin, a namespaced call, another name, another case and a later definition shadow nothing', () => {
  const quiet = (source, options = {}) => protect(source, { reserved: RESERVED, ...options });
  assert.deepEqual(quiet('@mixin space($k) { padding: $k; }\n.a { @include space(2); padding: space(2); }').problems, []);
  assert.equal(quiet('@mixin space($k) { padding: $k; }\n.a { @include space(2); padding: space(2); }').code, '@mixin space($k) { padding: $k; }\n.a { @include space(2); padding: #{"space(2)"}; }', 'a mixin never conflicts: the token call is protected');
  assert.deepEqual(quiet('@function double($n) { @return $n * 2; }').problems, [], 'another name');
  assert.deepEqual(quiet('@function Space($k) { @return 1; }\n.a { p: space(2); }').problems, [], 'Sass resolves functions by their exact name');
  assert.equal(quiet('@function Space($k) { @return 1; }\n.a { p: space(2); }').code, '@function Space($k) { @return 1; }\n.a { p: #{"space(2)"}; }');
  assert.deepEqual(quiet('/* @function space($k) {} */\n// @function md($v) {}\n.a { content: "@function color($c) {}"; }').problems, [], 'comments and strings are text');
  assert.deepEqual(quiet('@function xxl($v) { @return $v; }').problems, [], 'a name that is not a breakpoint of the effective theme');
  assert.deepEqual(quiet('@function xxl($v) { @return $v; }', { reserved: ['xxl'] }).problems.map((p) => p.name), ['xxl'], 'the caller decides the reserved names');
  // A call before the definition is plain CSS to Sass whether or not it is protected: the output is the same.
  const later = quiet('.a { padding: space(2); }\n@function space($k) { @return $k * 3px; }\n.b { padding: space(2); }');
  assert.equal(later.code, '.a { padding: #{"space(2)"}; }\n@function space($k) { @return $k * 3px; }\n.b { padding: space(2); }');
  assert.equal(flat(sass.compileString(later.code, { style: 'expanded' }).css), flat('.a { padding: space(2); } .b { padding: 6px; }'));
  // The warning is a warning: protect() never throws, and the problems carry no other code.
  assert.ok(quiet('@function space($k) { @return $k; }').problems.every((p) => p.code === 'UXD_FUNCTION_SHADOWED'));
});

// --- T5: R5 and R6, lines preserved and columns mapped -----------------------------

test('MIG-B9-11: lines are preserved and toOriginalColumn maps before, inside and after two rewrites on one line', () => {
  const source = '.a { color: palette(primary.main); padding: space(2); }';
  const result = protect(source, { reserved: RESERVED });
  assert.equal(result.code, '.a { color: #{"palette(primary.main)"}; padding: #{"space(2)"}; }');
  const col = (needle, text) => text.indexOf(needle);
  // Before the first rewrite: identical.
  assert.equal(result.toOriginalColumn(0, 0), 0);
  assert.equal(result.toOriginalColumn(0, col('color', result.code)), col('color', source));
  // Inside the first rewrite: its own start.
  for (const offset of [0, 3, 10, 24]) assert.equal(result.toOriginalColumn(0, col('#{"palette', result.code) + offset), col('palette', source));
  // Between the rewrites: shifted by the first one (5 characters: `#{"` and `"}`).
  assert.equal(result.toOriginalColumn(0, col('padding', result.code)), col('padding', source));
  assert.equal(col('padding', result.code) - col('padding', source), 5);
  // Inside the second: its start; after both: shifted by 10.
  assert.equal(result.toOriginalColumn(0, col('#{"space', result.code) + 4), col('space', source));
  assert.equal(result.toOriginalColumn(0, col(' }', result.code)), col(' }', source));
  assert.equal(result.toOriginalColumn(0, result.code.length - 1), source.length - 1);
  // A line with no rewrite maps to itself, including a line the result never saw.
  assert.equal(result.toOriginalColumn(7, 12), 12);

  // Lines are preserved: a rewrite spanning lines re-emits its newlines after the replacement.
  const multi = '.a {\n  padding: space(\n    2\n  );\n  color: red;\n}\n';
  const spanned = protect(multi, { reserved: RESERVED });
  assert.equal(spanned.code.split('\n').length, multi.split('\n').length);
  assert.equal(spanned.code, '.a {\n  padding: #{"space(2)"}\n\n;\n  color: red;\n}\n');
  assert.equal(spanned.toOriginalColumn(1, 2), 2, 'before the rewrite on its first line');
  assert.equal(spanned.toOriginalColumn(1, 11 + 5), 11, 'inside the rewrite: the start of space(');
  assert.equal(spanned.toOriginalColumn(3, 0), 3, 'the `;` after the closing parenthesis is column 3 of source line 4');
  assert.equal(spanned.toOriginalColumn(4, 2), 2, 'a later line is untouched');
  // The directive case too: `$t` → `#{$t}` across lines.
  const directive = protect('.a {\n  @ds-button(\n    contained\n    $t\n  );\n}', { reserved: RESERVED });
  assert.equal(directive.code.split('\n').length, 6);
  assert.equal(directive.toOriginalColumn(3, 4 + 2), 4, 'inside #{$t}: the column of $t');
  assert.equal(directive.toOriginalColumn(3, 4 + 5 + 1), 4 + 2 + 1, 'after it: shifted by 3');
  // Lines are preserved on every case of the list.
  for (const [id, source] of CASES) assert.equal(protect(source, { reserved: RESERVED }).code.split('\n').length, source.split('\n').length, id);
});

// --- T8: R8, the Bootstrap corpus ---------------------------------------------------

/** Bootstrap 5.3.8's scss/ directory: `UXDSL_SASS_CORPUS` (the package directory or its scss/ directory), or a bootstrap package resolvable from this package. */
function bootstrapScssDir() {
  const candidates = [];
  if (process.env.UXDSL_SASS_CORPUS) candidates.push(process.env.UXDSL_SASS_CORPUS, path.join(process.env.UXDSL_SASS_CORPUS, 'scss'), path.join(process.env.UXDSL_SASS_CORPUS, 'node_modules/bootstrap/scss'));
  try { candidates.push(path.join(path.dirname(require.resolve('bootstrap/package.json')), 'scss')); } catch { /* not installed here */ }
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'bootstrap.scss')));
}

function scssFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? scssFiles(file) : entry.name.endsWith('.scss') ? [file] : [];
  });
}

const corpus = bootstrapScssDir();
test('MIG-B9-11: protect handles the Bootstrap corpus in under 20 ms, and is the identity on every file', { skip: corpus ? false : 'Bootstrap 5.3.8 is not available: set UXDSL_SASS_CORPUS to a directory holding node_modules/bootstrap (fixtures/sass-corpus/run.js --keep prints one)' }, (t) => {
  const files = scssFiles(corpus).sort();
  const sources = files.map((file) => fs.readFileSync(file, 'utf8'));
  const bytes = sources.reduce((sum, text) => sum + Buffer.byteLength(text), 0);
  assert.ok(files.length >= 90, `${files.length} files`);
  // The first pass over the corpus is dominated by JIT warm-up (about 12 ms on an
  // M-series Mac for 2 ms of steady-state work); the budget is measured on the
  // second pass, and both figures are reported.
  const timed = () => {
    const start = process.hrtime.bigint();
    const results = sources.map((text) => protect(text, { reserved: RESERVED }));
    return { results, ms: Number(process.hrtime.bigint() - start) / 1e6 };
  };
  const cold = timed();
  const { results, ms } = timed();
  results.forEach((result, index) => {
    assert.equal(result.code, sources[index], path.relative(corpus, files[index]));
    assert.deepEqual(result.problems, [], path.relative(corpus, files[index]));
  });
  assert.ok(ms < 20, `${files.length} files, ${bytes} bytes: ${ms.toFixed(1)} ms`);
  t.diagnostic(`Bootstrap corpus: ${files.length} files, ${bytes} bytes; protect ${ms.toFixed(1)} ms (first pass, cold: ${cold.ms.toFixed(1)} ms)`);
});

// --- the site option: the Sass stage's per-call decisions ----------------------------------

/** Every column of every line of `code`, mapped by both results: equal maps on every position. */
function sameColumnMap(a, b, code) {
  code.split('\n').forEach((line, line0) => {
    for (let column0 = 0; column0 <= line.length + 2; column0++) assert.equal(a.toOriginalColumn(line0, column0), b.toOriginalColumn(line0, column0), `${line0}:${column0}`);
  });
}

test('MIG-B9-12: protect\'s site option reports token and plain calls and decides each token call; without it the output is unchanged', () => {
  // A callback that decides nothing changes nothing, on every case of the list.
  for (const [id, source] of CASES) {
    const plain = protect(source, { reserved: RESERVED, file: 'case.uxdsl' });
    const seen = [];
    const observed = protect(source, { reserved: RESERVED, file: 'case.uxdsl', site: (call) => { seen.push(call); return undefined; } });
    assert.equal(observed.code, plain.code, id);
    assert.deepEqual(observed.problems, plain.problems, id);
    sameColumnMap(observed, plain, plain.code);
    for (const call of seen) assert.equal(call.raw, source.slice(call.start, call.end), id);
  }
  // Token calls: what the first rule rewrites, with its default text; null leaves the call, a string replaces it.
  const source = '.a { padding: space(2); color: palette(primary.main); }';
  const calls = [];
  protect(source, { reserved: RESERVED, site: (call) => { calls.push(call); } });
  assert.deepEqual(calls, [
    { kind: 'token', name: 'space', start: 14, end: 22, raw: 'space(2)', protectedText: '#{"space(2)"}', defaultProtected: true },
    { kind: 'token', name: 'palette', start: 31, end: 52, raw: 'palette(primary.main)', protectedText: '#{"palette(primary.main)"}', defaultProtected: true },
  ]);
  assert.equal(protect(source, { reserved: RESERVED, site: () => null }).code, source);
  const replaced = protect(source, { reserved: RESERVED, site: (call) => (call.name === 'space' ? 'S' : undefined) });
  assert.equal(replaced.code, '.a { padding: S; color: #{"palette(primary.main)"}; }');
  assert.equal(replaced.toOriginalColumn(0, replaced.code.indexOf('color')), source.indexOf('color'));
  // A replaced call that spans lines keeps the line count and an exact column map after it.
  const multi = '.a {\n  padding: space(\n    2\n  ) red;\n}\n';
  const spanned = protect(multi, { reserved: RESERVED, site: () => 'R' });
  assert.equal(spanned.code, '.a {\n  padding: R\n\n red;\n}\n');
  assert.equal(spanned.code.split('\n').length, multi.split('\n').length);
  assert.equal(spanned.toOriginalColumn(3, 0), 3, 'the space before `red` is column 3 of source line 4');
  assert.equal(spanned.toOriginalColumn(3, 1), 4);
  assert.equal(spanned.toOriginalColumn(1, 11), 11, 'inside the replacement: the call\'s start');
  // Plain calls: a breakpoint, tone() and a token call whose key is not key-like; reported, never rewritten, scanned inside.
  const plainCalls = [];
  const plainSource = '.a { padding: md(space(2)); color: tone(main); margin: space(2 + 1); }';
  const plainResult = protect(plainSource, { reserved: RESERVED, site: (call) => { plainCalls.push(`${call.kind}:${call.name}:${call.raw}`); return 'IGNORED'; } });
  assert.deepEqual(plainCalls, ['plain:md:md(space(2))', 'token:space:space(2)', 'plain:tone:tone(main)', 'plain:space:space(2 + 1)']);
  assert.equal(plainResult.code, '.a { padding: md(IGNORED); color: tone(main); margin: space(2 + 1); }', 'a plain call is never rewritten; the token call inside it is decided');
  // After a same-file definition the default leaves the call bare; the site sees it with defaultProtected false.
  const defined = [];
  const definedResult = protect('@function space($k) { @return $k; }\n.a { p: space(2); }', { reserved: RESERVED, site: (call) => { defined.push(call); } });
  assert.deepEqual(defined.map((call) => [call.kind, call.raw, call.defaultProtected, call.protectedText]), [['token', 'space(2)', false, '#{"space(2)"}']]);
  assert.equal(definedResult.code.split('\n')[1], '.a { p: space(2); }');
  assert.equal(protect('@function space($k) { @return $k; }\n.a { p: space(2); }', { reserved: RESERVED, site: (call) => call.protectedText }).code.split('\n')[1], '.a { p: #{"space(2)"}; }', 'a decision overrides the default');
  // Underscore and case: the name as Sass resolves it.
  const named = [];
  protect('.a { a: SPACE(2); b: x_large(1px); }', { reserved: ['x-large'], site: (call) => { named.push(`${call.kind}:${call.name}`); } });
  assert.deepEqual(named, ['token:SPACE', 'plain:x-large']);
  // Nothing inside comments, strings or an unquoted url() is reported.
  const quiet = [];
  protect('/* space(2) */ .a { content: "md(1px)"; background: url(space(2).png); } // tone(main)', { reserved: RESERVED, site: (call) => { quiet.push(call); } });
  assert.deepEqual(quiet, []);
});

test('MIG-B9-12: protect\'s site option decides each token call (negative control: the callback is consulted, and a replacement must be one line)', () => {
  const source = '.a { padding: space(2); }';
  assert.notEqual(protect(source, { reserved: RESERVED, site: () => 'X' }).code, protect(source, { reserved: RESERVED }).code);
  assert.throws(() => protect(source, { reserved: RESERVED, site: () => 'a\nb' }), TypeError);
});

// --- R9: the restore ----------------------------------------------------------------------

test('MIG-B9-11: restoreDirectiveSpacing removes the space Dart Sass writes before a directive\'s parenthesis, and only there', () => {
  assert.equal(restoreDirectiveSpacing.postcssPlugin, 'uxdsl/sass-restore');
  const compiled = sass.compileString('$t: primary;\n.a { @ds-surface(contained #{$t}); @DS-TYPO(h2); @media (min-width: 1px) { color: red; } }', { style: 'expanded' }).css;
  assert.match(compiled, /@ds-surface \(contained primary\)/);
  assert.match(compiled, /@DS-TYPO \(h2\)/);
  const restored = postcss([restoreDirectiveSpacing]).process(compiled, { from: undefined }).css;
  assert.match(restored, /@ds-surface\(contained primary\)/);
  assert.match(restored, /@DS-TYPO\(h2\)/);
  assert.match(restored, /@media \(min-width: 1px\)/, 'another at-rule keeps its spacing');
  // Without the restore the plugin rejects what Sass wrote; with it, the directive compiles.
  assert.throws(() => postcss([uxdsl()]).process(compiled, { from: undefined }).css, /UXD_SURFACE_ARGUMENT/);
  assert.match(postcss([restoreDirectiveSpacing, uxdsl()]).process(compiled, { from: undefined }).css, /--uxdsl__surface__contained-padding/);
});
