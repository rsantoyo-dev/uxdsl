'use strict';

// MIG-B9-10 (FEAT-010): the Sass matrix. The 110 cases of scss-subset.test.js,
// same names and sources, expected to what compile() must produce once it runs
// on Dart Sass (MIG-B9-13): a Sass-valid source compiles to Dart Sass's CSS, an
// invalid-Sass source fails as UXD_SASS, a UXDSL source compiles to what
// compile() produces today. The expectations are in sass-matrix.cases.js,
// recorded by sass-matrix.record.js; the "sass" group is recorded from the
// `sass` package itself, so the test that compares those literals with live
// Dart Sass runs now and notices a Sass upgrade that changes output.
//
// Each case through compile() is `todo` until MIG-B9-13: node:test runs it and
// reports the result without failing the suite. What can pass today does:
// the live-Sass comparison, the "today" literals against compile(), the shape
// of the matrix, and the negative controls.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const postcss = require('postcss');
const csstree = require('css-tree');

const core = require('../../dist/entries/index.js');
const { CASES, expectedErrors, SASS_VERSION } = require('./sass-matrix.cases.js');
const { normalize, liveSass, sassVersion } = require('./sass-matrix.record.js');

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

/** compile() on a case, `includeTheme: false`: `{ css }` (normalized) or `{ error, message, located }`. */
async function compiled(name, source) {
  const entry = path.join(dir, `${name}.uxdsl`);
  fs.writeFileSync(entry, source + '\n');
  try {
    return { css: normalize((await core.compile({ entry }, { includeTheme: false })).css) };
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

// --- The shape of the matrix (runs now).

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

test('MIG-B9-10: the matrix has the same names and sources as scss-subset.test.js (while that file exists)', () => {
  const old = path.join(__dirname, 'scss-subset.test.js');
  if (!fs.existsSync(old)) return; // MIG-B9-13 deletes the old matrix; the names and sources live here from then on.
  const text = fs.readFileSync(old, 'utf8');
  const OLD = new Function('return ' + /const CASES = (\[[\s\S]*?\n\]);/.exec(text)[1])();
  assert.deepEqual(CASES.map(([name, source]) => [name, source]), OLD.map(([name, source]) => [name, source]));
});

// --- Dart Sass is the oracle of the "sass" group (runs now; a Sass upgrade that
// changes output fails it until the matrix is re-recorded).

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

// --- The "today" group is compile()'s output today, byte for byte (runs now, and
// keeps running after MIG-B9-13: the UXDSL semantics do not change).

test('MIG-B9-10: every "today" expectation is what compile() produces today, byte for byte', async () => {
  for (const [name, source, expected] of byGroup('today')) {
    const actual = await compiled(name, source);
    if (expected.error !== undefined) assert.equal(actual.error, expected.error, name);
    else assert.equal(actual.css, expected.css, name);
  }
});

// --- Every case through compile() (todo until MIG-B9-13).

const tally = { ok: 0, error: 0, sass: 0 };
for (const [name, source, expected, meta] of CASES) {
  test.todo(`MIG-B9-10: sass matrix: ${name}`, async () => {
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

test.todo('MIG-B9-10: the matrix has 110 cases and its errors are exactly the invalid-Sass sources (through compile())', () => {
  assert.equal(tally.ok + tally.error, 110, 'every case ran');
  assert.equal(tally.sass, expectedErrors, 'the UXD_SASS failures are the invalid-Sass sources');
  assert.equal(tally.error, CASES.filter(([, , expected]) => expected.error !== undefined).length);
});
