'use strict';

// A declaration the UXDSL grammar does not change leaves the compiler exactly
// as it entered: its value's whitespace, its inline comments, an empty custom
// property. "Rename .scss to .uxdsl and get the same CSS" needs the plugin to
// be an identity on CSS it has nothing to say about.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');

const exported = require('../dist/plugin');
const plugin = exported.default || exported;
const core = require('../dist/entries/index.js');

// Each probe is a declaration the grammar has nothing to rewrite. PostCSS's own
// parse and stringify are an identity on all of them (asserted below), so any
// difference is the plugin's.
const PROBES = [
  'a{--x: ;}',
  'a{content: var(--d, "/") /* rtl: var(--d, "/") */;}',
  'a{transform: rotate(360deg) /* rtl:ignore */;}',
  'a{color: red/* c */;}',
  'a{margin: 0 /* c */ auto;}',
  'a{--y: 1px /* keep */;}',
];

const throughPlugin = (source) => postcss([plugin({ includeTheme: false, discoverTheme: false })])
  .process(source, { from: undefined }).css;
const throughCompile = async (source) => (await core.compile({ source }, { includeTheme: false })).css;

test('MIG-B9-05: PostCSS alone is an identity on every probe (the control the other assertions rely on)', () => {
  for (const probe of PROBES) {
    assert.equal(postcss([]).process(probe, { from: undefined }).css, probe, probe);
  }
});

test('MIG-B9-05: declarations the grammar does not change are byte-identical through uxdsl/postcss', () => {
  for (const probe of PROBES) assert.equal(throughPlugin(probe), probe, probe);
});

test('MIG-B9-05: declarations the grammar does not change are byte-identical through compile()', async () => {
  for (const probe of PROBES) assert.equal((await throughCompile(probe)).trim(), probe, probe);
});

test('MIG-B9-05 (positive control): a declaration with a token is still rewritten, and keeps its trailing comment', async () => {
  const source = 'a{padding: space(2) /* keep */;}';
  const expected = 'a{padding: var(--uxdsl__space__2) /* keep */;}';
  assert.equal(throughPlugin(source), expected);
  assert.equal((await throughCompile(source)).trim(), expected);
});

test('MIG-B9-05 (positive control): a responsive value is still split, and an untouched sibling keeps its comment', () => {
  const out = throughPlugin('a{margin: 0 /* c */ auto; padding: xs(1px) md(2px);}');
  assert.match(out, /margin: 0 \/\* c \*\/ auto;/);
  assert.match(out, /padding: 1px/);
  assert.match(out, /@media \(min-width: \d+px\) \{\s*a\s*\{\s*padding: 2px/);
});
