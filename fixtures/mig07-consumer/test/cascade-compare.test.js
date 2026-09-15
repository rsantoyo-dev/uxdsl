'use strict';

// Regression coverage for lib/css-cascade-compare.js — run via
// `node --test test/cascade-compare.test.js` from this directory (after an
// install, so `postcss` resolves; run.js's main() runs this automatically
// right after packAndInstall(), before it relies on the comparison for the
// real PostCSS/runtime parity check).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { cascadedVariables, mapsEqual } = require('../lib/css-cascade-compare');

const req = require('module').createRequire(path.join(__dirname, '..', 'package.json'));
const postcss = req('postcss');

test('same-scope declaration order changes the effective winner', () => {
  const a = cascadedVariables(':root { --uxdsl__space__1: 1px; --uxdsl__space__1: 2px; }', postcss);
  const b = cascadedVariables(':root { --uxdsl__space__1: 2px; --uxdsl__space__1: 1px; }', postcss);
  assert.equal(mapsEqual(a, b), false, 'a repeated declaration in opposite orders must not compare equal');
});

test('an earlier !important still beats a later non-important declaration', () => {
  const c = cascadedVariables(':root { --x: 1px; --x: 2px !important; }', postcss);
  const d = cascadedVariables(':root { --x: 2px !important; --x: 1px; }', postcss);
  assert.equal(mapsEqual(c, d), true, 'both must resolve to the !important value regardless of order');
});

test('reordering two overlapping min-width blocks changes the winner from the higher threshold up (the reported gap)', () => {
  const forward = [
    ':root { --x: 1; }',
    '@media (min-width: 600px) { :root { --x: 2; } }',
    '@media (min-width: 800px) { :root { --x: 3; } }',
  ].join('\n');
  const reversed = [
    ':root { --x: 1; }',
    '@media (min-width: 800px) { :root { --x: 3; } }',
    '@media (min-width: 600px) { :root { --x: 2; } }',
  ].join('\n');
  const a = cascadedVariables(forward, postcss);
  const b = cascadedVariables(reversed, postcss);
  assert.equal(mapsEqual(a, b), false, 'swapping overlapping @media blocks must be detected, not treated as equal');
});

test('two overlapping min-width blocks that are NOT reordered still compare equal', () => {
  const css = [
    ':root { --x: 1; }',
    '@media (min-width: 600px) { :root { --x: 2; } }',
    '@media (min-width: 800px) { :root { --x: 3; } }',
  ].join('\n');
  const a = cascadedVariables(css, postcss);
  const b = cascadedVariables(css, postcss);
  assert.equal(mapsEqual(a, b), true, 'identical input must still compare equal (no false positive)');
});

test('non-overlapping (disjoint selector) media blocks are unaffected by reordering', () => {
  const forward = [
    '.a { color: red; }',
    '@media (min-width: 600px) { .b { --y: 1; } }',
    '@media (min-width: 800px) { .c { --y: 2; } }',
  ].join('\n');
  const reversed = [
    '.a { color: red; }',
    '@media (min-width: 800px) { .c { --y: 2; } }',
    '@media (min-width: 600px) { .b { --y: 1; } }',
  ].join('\n');
  const a = cascadedVariables(forward, postcss);
  const b = cascadedVariables(reversed, postcss);
  assert.equal(mapsEqual(a, b), true, 'reordering media blocks that touch different selectors changes nothing to compare');
});

test('a mode condition (e.g. prefers-color-scheme) is kept as its own scope, not modeled as a width threshold', () => {
  const css = [
    ':root { --x: 1; }',
    '@media (prefers-color-scheme: dark) { :root { --x: 2; } }',
  ].join('\n');
  const vars = cascadedVariables(css, postcss);
  assert.equal(vars.some((v) => v.includes('at:media:(prefers-color-scheme: dark)')), true);
});
