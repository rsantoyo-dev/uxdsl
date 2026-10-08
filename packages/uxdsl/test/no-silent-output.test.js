'use strict';

// Stability phase 3 (audit findings L1, L2, L3, L18, L19; "no silent output"):
// every way a responsive expression used to reach CSS as invalid text, or
// leave an empty rule behind, is a located error — or, for a rule the split
// emptied, simply gone.
const { test } = require('node:test');
const assert = require('node:assert/strict');
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

test('the standalone plugin resolves root-level $variables only: a rule-scoped one is UXD_VARIABLE_CONTEXT, an undefined one UXD_VARIABLE_UNDEFINED', () => {
  assert.equal(compile('$x: 1px;\n.a { width: $x; }'), '.a { width: 1px; }');
  const [scoped, scopedReason, scopedError] = errorOf('.a {\n  $x: 1px;\n  width: $x;\n}');
  assert.equal(scoped, 'UXD_VARIABLE_CONTEXT', scopedReason);
  assert.equal(scopedError.line, 2);
  assert.match(scopedReason, /uxdsl-core|uxdsl build/);
  const [undefinedCode, undefinedReason, undefinedError] = errorOf('.a {\n  width: $gap;\n}');
  assert.equal(undefinedCode, 'UXD_VARIABLE_UNDEFINED', undefinedReason);
  assert.equal(undefinedError.line, 2);
  assert.match(undefinedReason, /\$gap/);
  // A dollar inside a string is not a variable.
  assert.equal(compile('.a::before { content: "$5"; }'), '.a::before { content: "$5"; }');
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
