'use strict';

// MIG-B6-15 (FEAT-008): a responsive value's `!important` flag lives on
// `decl.important` (PostCSS strips the literal text out of `decl.value`
// during parsing), not inside the value string itself. The declarations
// this plugin generates for every breakpoint beyond the base one used to be
// built as plain `{ prop, value, source }` objects with no `important` key
// — the base breakpoint kept `!important` (it reuses the original decl
// node, only mutating `.value`), but every other `@media` block silently
// lost it, so a competing, non-responsive `!important` declaration
// elsewhere in the cascade could still win from md/lg/xl up.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const exported = require('../dist/index');
const plugin = exported.default || exported;

async function compile(css, theme = {}) {
  return (await postcss([plugin({ theme, includeTheme: false })]).process(css, { from: undefined })).css;
}

function importantFlags(css, prop) {
  const flags = [];
  postcss.parse(css).walkDecls(prop, decl => flags.push(!!decl.important));
  return flags;
}

test('MIG-B6-15: a responsive xs()/md() value keeps !important in the base declaration and every generated @media block', async () => {
  const css = await compile('.a { padding: xs(1rem) md(2rem) !important; }');
  assert.deepEqual(importantFlags(css, 'padding'), [true, true]);
  assert.match(css, /\.a\s*\{\s*padding:\s*1rem\s*!important;?\s*\}/);
  assert.match(css, /@media \(min-width: 768px\)[\s\S]*padding:\s*2rem\s*!important/);
});

test('MIG-B6-15: a responsive value across three breakpoints keeps !important at every one, not just the first two', async () => {
  const css = await compile('.a { margin: xs(1px) md(2px) xl(3px) !important; }');
  assert.deepEqual(importantFlags(css, 'margin'), [true, true, true]);
});

test('MIG-B6-15 (positive control): a non-important responsive value never gains !important anywhere', async () => {
  const css = await compile('.a { padding: xs(1rem) md(2rem); }');
  assert.deepEqual(importantFlags(css, 'padding'), [false, false]);
});

test('MIG-B6-15: !important on a density() reference is preserved (density\'s own responsiveness lives in the token, not the consuming declaration)', async () => {
  const theme = { densities: { 2: 'xs(4px) md(8px)' } };
  const css = await compile('.a { gap: density(2) !important; }', theme);
  // Only one `gap:` declaration is expected here: `density(2)` compiles to a
  // single `var(--uxdsl__density__2)` reference — the breakpoint-dependent
  // part is the density token's own value at :root, not multiple `gap:`
  // declarations in .a. The bug this test guards against would still show
  // up as `!important` missing from this one declaration.
  assert.deepEqual(importantFlags(css, 'gap'), [true]);
});

test('MIG-B6-15: a responsive custom property keeps !important across breakpoints', async () => {
  const css = await compile('.a { --my-gap: xs(4px) md(8px) !important; }');
  assert.deepEqual(importantFlags(css, '--my-gap'), [true, true]);
});

test('MIG-B6-15: !important on a responsive value nested under a rule (not the fallback/root-level branch) is preserved', async () => {
  const css = await compile('@media (min-width: 10px) { .a { padding: xs(1rem) md(2rem) !important; } }');
  assert.deepEqual(importantFlags(css, 'padding'), [true, true]);
});
