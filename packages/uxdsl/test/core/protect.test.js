'use strict';

// MIG-B9-10 (FEAT-010): the protect/restore cases, end to end through compile().
// Every case is `todo` until MIG-B9-13 puts compile() on Dart Sass: node:test runs
// it and reports the result without failing the suite. MIG-B9-11 adds the unit
// tests of protect() itself to this file.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');

const core = require('../../dist/entries/index.js');
const exported = require('../../dist/plugin');
const plugin = exported.default || exported;
const { THEME, CASES } = require('./protect.cases.js');

/** Whitespace-insensitive comparison: Sass's expanded layout and the plugin's own
 * formatting differ only in spacing around punctuation. */
const flat = (css) => css.replace(/\s+/g, ' ').replace(/\s*([{};,])\s*/g, '$1').replace(/;}/g, '}').trim();

const codeOf = (error) => (/\b(UXD_[A-Z0-9_]+)\b/.exec(String(error && error.message)) || [])[1] || String(error);

/** What the UXDSL plugin alone (no Sass) makes of `source`: `{ css }` or `{ error }`. */
function oracle(source) {
  try {
    return { css: postcss([plugin({ theme: THEME, includeTheme: false, discoverTheme: false })]).process(source, { from: undefined }).css };
  } catch (error) {
    return { error: codeOf(error) };
  }
}

async function pipeline(source) {
  try {
    const result = await core.compile({ source }, { theme: THEME, includeTheme: false });
    return { css: result.css, warnings: result.warnings.map((warning) => codeOf({ message: warning.text })) };
  } catch (error) {
    return { error: codeOf(error) };
  }
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

for (const [id, source, expected, options = {}] of CASES) {
  test.todo(`MIG-B9-10: protect/restore end to end: ${id}`, async () => {
    const actual = await pipeline(source);
    if (typeof expected === 'string' && expected.startsWith('ERROR:')) {
      assert.equal(actual.error, expected.slice('ERROR:'.length), `${id} should fail with ${expected}`);
      return;
    }
    const want = typeof expected === 'string' ? { css: expected } : oracle(expected.sameAs);
    if (want.error) {
      assert.equal(actual.error, want.error, `${id} should fail like its plain-UXDSL form`);
      return;
    }
    assert.equal(actual.error, undefined, `${id} failed: ${actual.error}`);
    assert.equal(flat(actual.css), flat(want.css), id);
    if (options.warning) assert.ok(actual.warnings.includes(options.warning), `${id} should warn ${options.warning}`);
  });
}
