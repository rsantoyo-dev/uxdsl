'use strict';

// MIG-B6-14 (FEAT-008): `$var` substitution used to run AFTER the
// responsive-expansion walk, so a declaration whose value was still the
// literal string "$gap" at expansion time never got split into media
// queries — `$gap: xs(1rem) md(2rem); .a { gap: $gap; }` compiled to the
// invalid, unexpanded `.a { gap: xs(1rem) md(2rem); }`. Substitution now
// runs first, matching what the CLI already produces when
// postcss-advanced-variables resolves $vars ahead of this plugin.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const postcss = require('postcss');
const plugin = require('../dist');

const file = path.join(process.cwd(), 'src', 'panel.uxdsl');

async function compile(css) {
  return postcss([plugin({ includeTheme: false })]).process(css, { from: file });
}

test('MIG-B6-14: a responsive $var expands into base value plus a media query, same as an inline responsive value', async () => {
  const result = await compile('$gap: xs(1rem) md(2rem);\n.a { gap: $gap; }');
  assert.match(result.css, /\.a\s*\{\s*gap:\s*1rem;?\s*\}/);
  assert.match(result.css, /@media \(min-width: 768px\)/);
  assert.match(result.css, /gap:\s*2rem/);
  assert.doesNotMatch(result.css, /\$gap/);
  assert.doesNotMatch(result.css, /xs\(|md\(/, 'no unexpanded breakpoint function left in the output');
});

test('MIG-B6-14 (positive control): a non-responsive $var still substitutes as a plain value', async () => {
  const result = await compile('$radius-ish: 4px;\n.a { border-radius: $radius-ish; }');
  assert.match(result.css, /border-radius:\s*4px/);
});

test('MIG-B6-14: a $var used across multiple breakpoint-named declarations each expand independently', async () => {
  const result = await compile('$pad: xs(1rem) md(2rem) xl(3rem);\n.a { padding: $pad; }\n.b { margin: $pad; }');
  assert.match(result.css, /\.a\s*\{\s*padding:\s*1rem;?\s*\}/);
  assert.match(result.css, /\.b\s*\{\s*margin:\s*1rem;?\s*\}/);
  assert.match(result.css, /@media \(min-width: 768px\)/);
  assert.match(result.css, /@media \(min-width: 1280px\)/);
});

test('MIG-B6-14: a $var value combined with UXDSL tokens still resolves both the token and the responsive split', async () => {
  const theme = { spacing: { 1: '4px', 2: '8px' } };
  const result = await postcss([plugin({ includeTheme: false, theme })])
    .process('$gap: xs(space(1)) md(space(2));\n.a { gap: $gap; }', { from: file });
  assert.match(result.css, /gap:\s*var\(--uxdsl__space__1\)/);
  assert.match(result.css, /@media \(min-width: 768px\)/);
  assert.match(result.css, /gap:\s*var\(--uxdsl__space__2\)/);
});
