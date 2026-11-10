'use strict';

// The Sass matrix: 110 cases expected to what compile() produces on Dart Sass.
// A Sass-valid source compiles to Dart Sass's CSS, an invalid-Sass source fails
// as UXD_SASS with Sass's message, and a UXDSL source compiles to its recorded
// literal. The expectations are in sass-matrix.cases.js, recorded by
// sass-matrix.record.js; the "sass" group is recorded from the `sass` package
// itself, so the test that compares those literals with live Dart Sass notices
// a Sass upgrade that changes output, and one more test compares compile()'s
// output with live Dart Sass byte for byte.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const postcss = require('postcss');
const csstree = require('css-tree');

const core = require('../../dist/entries/index.js');
const { CASES, expectedErrors, SASS_VERSION } = require('./sass-matrix.cases.js');
const { normalize, liveSass, sassVersion, expectationFor } = require('./sass-matrix.record.js');

const FIXTURES = path.join(__dirname, 'fixtures/scss-subset');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-sass-matrix-'));
for (const file of fs.readdirSync(FIXTURES)) fs.copyFileSync(path.join(FIXTURES, file), path.join(dir, file));

/** Everything that would make a compiled stylesheet invalid or Sass-flavoured
 * (the old matrix's check, unchanged). */
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
    // (`width: rgba(…)`, `width: 10px/2`) is theirs, not the compiler's.
    if (!prop.startsWith('--') && !value.includes('var(') && !authorValue) {
      const match = csstree.lexer.matchProperty(prop, value);
      if (match.error && match.error.name !== 'SyntaxReferenceError') problems.push(prop + ': ' + value + ' (' + match.error.message.split('\n')[0] + ')');
    }
  });
  return problems;
}

const codeOf = (message) => (/\b(UXD_[A-Z0-9_]+)\b/.exec(String(message)) || [])[1];

/** compile() on a case (no marker, so no theme): `{ css }` (normalized) or `{ error, message, located }`. */
async function compiled(name, source) {
  const entry = path.join(dir, `${name}.uxdsl`);
  fs.writeFileSync(entry, source + '\n');
  try {
    return { css: normalize((await core.compile({ entry })).css) };
  } catch (error) {
    return { error: codeOf(error.message), message: error.message, located: /:\d+:\d+:/.test(error.message) || typeof error.line === 'number' };
  }
}

/** Whether a "sass" case's recorded expectation is what the installed Dart Sass produces. */
function matchesLiveSass([name, source, expected]) {
  const live = liveSass(name, source);
  if (expected.css !== undefined) return { equal: live.css === expected.css, live };
  return { equal: live.error !== undefined && expected.error === 'UXD_SASS' && expected.sass === live.error, live };
}

const byGroup = (group) => CASES.filter(([, , , meta]) => meta.group === group);

// --- The shape of the matrix.

test('MIG-B9-10: the matrix has 110 cases and its errors are exactly the invalid-Sass sources', () => {
  assert.equal(CASES.length, 110);
  assert.equal(new Set(CASES.map(([name]) => name)).size, 110, 'unique names');
  for (const [name, source, expected, meta] of CASES) {
    assert.equal(typeof source, 'string', name);
    assert.ok(['sass', 'today', 'mixed'].includes(meta.group), `${name}: group`);
    assert.ok((expected.css !== undefined) !== (expected.error !== undefined), `${name}: css or error, not both`);
    if (meta.group === 'mixed') assert.equal(meta.reviewed, true, `${name}: a mixed case is reviewed by hand`);
    if (expected.error === 'UXD_SASS') assert.equal(meta.group, 'sass', `${name}: only Dart Sass decides what is invalid Sass`);
    if (expected.sass !== undefined) assert.equal(expected.error, 'UXD_SASS', `${name}: a Sass message belongs to a UXD_SASS case`);
  }
  const invalid = CASES.filter(([, , expected]) => expected.error === 'UXD_SASS');
  assert.equal(expectedErrors, invalid.length);
  assert.ok(expectedErrors > 0, 'the matrix holds invalid Sass');
  assert.deepEqual({ sass: byGroup('sass').length, today: byGroup('today').length, mixed: byGroup('mixed').length }, { sass: 75, today: 20, mixed: 15 });
});

// --- Dart Sass is the oracle of the "sass" group (a Sass upgrade that changes
// output fails it until the matrix is re-recorded).

test('MIG-B9-10: every recorded Sass expectation equals live Dart Sass', () => {
  assert.equal(sassVersion(), SASS_VERSION, 're-record the matrix (sass-matrix.record.js --update) after a Sass upgrade');
  const drift = [];
  for (const entry of byGroup('sass')) {
    const { equal, live } = matchesLiveSass(entry);
    if (!equal) drift.push(`${entry[0]}\n  recorded: ${JSON.stringify(entry[2])}\n  live:     ${JSON.stringify(live)}`);
  }
  assert.deepEqual(drift, []);
});

test('MIG-B9-10: every recorded Sass expectation equals live Dart Sass (negative control)', () => {
  const [name, source, expected] = byGroup('sass').find(([, , e]) => e.css !== undefined);
  assert.equal(matchesLiveSass([name, source, { css: expected.css + ' .planted { color: red; }' }]).equal, false, 'a planted wrong literal is noticed');
  const [errorName, errorSource, errorExpected] = byGroup('sass').find(([, , e]) => e.error === 'UXD_SASS');
  assert.equal(matchesLiveSass([errorName, errorSource, { error: 'UXD_SASS', sass: errorExpected.sass + ' (planted)' }]).equal, false, 'a planted wrong Sass message is noticed');
  assert.equal(matchesLiveSass([errorName, errorSource, { css: '.planted { color: red; }' }]).equal, false, 'CSS expected of a source Sass rejects is noticed');
});

test('MIG-B9-10: every recorded Sass CSS is valid CSS with no Sass construct left', () => {
  for (const [name, , expected, meta] of byGroup('sass')) {
    if (expected.css === undefined) continue;
    assert.deepEqual(problemsOf(expected.css, meta), [], name);
  }
});

// --- compile() adds nothing to Dart Sass's output: every "sass" case that
// compiles is compared byte for byte with live Dart Sass on the same text.

const bytesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-sass-matrix-bytes-'));
for (const file of fs.readdirSync(FIXTURES)) fs.copyFileSync(path.join(FIXTURES, file), path.join(bytesDir, file));
const silentLogger = { warn() {}, debug() {} };

/** Dart Sass's CSS for `source` written as `<name>.scss`, and compile()'s for the same text written as `<name>.uxdsl`, side by side in one directory holding the matrix fixtures. */
async function bothCompilers(name, source) {
  const scss = path.join(bytesDir, `${name}.scss`);
  const uxdsl = path.join(bytesDir, `${name}.uxdsl`);
  fs.writeFileSync(scss, source + '\n');
  fs.writeFileSync(uxdsl, source + '\n');
  const live = require('sass').compile(scss, { style: 'expanded', logger: silentLogger }).css;
  const compiled = (await core.compile({ entry: uxdsl }, { theme: {} })).css;
  return { live, compiled };
}

/** The comparison: identity, not normalize(). */
const sameBytes = (live, compiled) => live === compiled;

test('MIG-B9-13: every "sass" case that compiles equals live Dart Sass byte for byte through compile()', async () => {
  const differ = [];
  let compared = 0;
  for (const [name, source, expected] of byGroup('sass')) {
    if (expected.css === undefined) continue;
    const { live, compiled } = await bothCompilers(name, source);
    compared++;
    if (!sameBytes(live, compiled)) differ.push(`${name}\n  Dart Sass: ${JSON.stringify(live)}\n  compile(): ${JSON.stringify(compiled)}`);
  }
  assert.equal(compared, byGroup('sass').length - expectedErrors, 'every "sass" case Dart Sass compiles is compared');
  assert.deepEqual(differ, []);
});

test('MIG-B9-13: every "sass" case that compiles equals live Dart Sass byte for byte through compile() (negative control)', async () => {
  const [name, source] = byGroup('sass').find(([, , expected]) => expected.css !== undefined);
  const { live, compiled } = await bothCompilers(name, source);
  assert.equal(sameBytes(live, compiled), true, 'control: the case itself is identical');
  assert.equal(sameBytes(live, `${compiled}\n`), false, 'a final newline, which the former pipeline wrote, is a difference');
  assert.equal(sameBytes(live, compiled.replace(';', ' !important;')), false, 'a changed declaration is a difference');
  assert.equal(normalize(`${compiled}\n`), normalize(live), 'normalize() hides the final newline, so the matrix comparison alone is not identity');
});

// --- The "today" group: UXDSL sources whose literals were recorded from compile()
// and are kept as written; the UXDSL semantics do not change with the pipeline.

test('MIG-B9-10: every "today" expectation is what compile() produces today, byte for byte', async () => {
  for (const [name, source, expected] of byGroup('today')) {
    const actual = await compiled(name, source);
    if (expected.error !== undefined) assert.equal(actual.error, expected.error, name);
    else assert.equal(actual.css, expected.css, name);
  }
});

test('MIG-B9-13: the recorder keeps the today group as written', async () => {
  const [name, source, expected, meta] = byGroup('today').find(([, , e]) => e.css !== undefined);
  const planted = { css: `${expected.css} .planted { color: red; }` };
  assert.deepEqual(await expectationFor([name, source, planted, meta]), planted, 'a "today" expectation is kept as written, never re-recorded from the current build');
  assert.deepEqual(await expectationFor([name, source, expected, meta]), expected);
  // The test above, not the recorder, is what checks a "today" literal: it rejects the planted one.
  const actual = await compiled(name, source);
  assert.equal(actual.css, expected.css);
  assert.notEqual(actual.css, planted.css);
});

// --- Every case through compile().

const tally = { ok: 0, error: 0, sass: 0 };
for (const [name, source, expected, meta] of CASES) {
  test(`MIG-B9-10: sass matrix: ${name}`, async () => {
    const actual = await compiled(name, source);
    if (expected.error !== undefined) {
      assert.equal(actual.error, expected.error, `${name}: expected ${expected.error}, got ${actual.error || `output: ${actual.css}`}`);
      assert.ok(actual.located, `${name}: the error is located`);
      if (expected.sass !== undefined) assert.ok(actual.message.includes(expected.sass), `${name}: the diagnostic carries Sass's message "${expected.sass}"`);
      tally.error++;
      if (expected.error === 'UXD_SASS') tally.sass++;
      return;
    }
    assert.equal(actual.error, undefined, `${name}: expected output, got an error: ${actual.message && actual.message.split('\n')[0]}`);
    assert.equal(actual.css, expected.css, name);
    assert.deepEqual(problemsOf(actual.css, meta), [], 'the output is valid CSS with no Sass construct left');
    tally.ok++;
  });
}

test('MIG-B9-10: the matrix has 110 cases and its errors are exactly the invalid-Sass sources (through compile())', () => {
  assert.equal(tally.ok + tally.error, 110, 'every case ran');
  assert.equal(tally.sass, expectedErrors, 'the UXD_SASS failures are the invalid-Sass sources');
  assert.equal(tally.error, CASES.filter(([, , expected]) => expected.error !== undefined).length);
});
