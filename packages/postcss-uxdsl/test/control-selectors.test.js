'use strict';

// MIG-B6-15 (FEAT-008): @ds-button/@ds-input generate their state selectors
// (`:hover`, `.is-selected`, ...) by splitting the host rule's selector on
// every comma and appending the state suffix to each piece. A plain
// `.split(',')` also splits *inside* a functional pseudo-class argument list
// (`:is(.x, .y)`, `:where(...)`, `:not(...)`, `:has(...)`) — those commas
// aren't selector-list separators, they're the pseudo-class's own argument
// list. `.btn:is(.x, .y)` used to become the selector fragments
// `.btn:is(.x` and ` .y)`, and appending `:hover` to each produced the
// invalid, silently-wrong `.btn:is(.x:hover, .y):hover` instead of the
// correct `.btn:is(.x, .y):hover`. postcss.list.comma is selector-aware and
// only splits top-level commas.
//
// @ds-surface never splits a selector at all (it inserts declarations
// directly into the host rule, not a separate generated ruleset per state),
// so it has no equivalent bug — covered here by a control asserting its
// selector-bearing functional pseudo-classes stay intact too.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const exported = require('../dist/index');
const plugin = exported.default || exported;

const BASE_PALETTE = { primary: { main: '#123', dark: '#111', contrast: '#fff' }, surface: { main: '#fff', dark: '#eee', contrast: '#000' }, neutral: { main: '#999', dark: '#333' }, error: { main: '#f00' } };
const FULL_SPACING = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i + 1, `${(i + 1) * 4}px`]));
const theme = { spacing: FULL_SPACING, palette: BASE_PALETTE };

async function compile(css) {
  return (await postcss([plugin({ theme, includeTheme: false })]).process(css, { from: undefined })).css;
}

const FUNCTIONAL_PSEUDOS = [
  ['.btn:is(.x, .y)', ':is(.x, .y)'],
  ['.btn:where(.x, .y)', ':where(.x, .y)'],
  ['.btn:not(.x, .y)', ':not(.x, .y)'],
  ['.btn:has(> .x, + .y)', ':has(> .x, + .y)'],
];

for (const [selector, intact] of FUNCTIONAL_PSEUDOS) {
  test(`MIG-B6-15: @ds-button preserves "${intact}" and appends state suffixes outside it`, async () => {
    const css = await compile(`${selector} { @ds-button(outlined primary 2); }`);
    const hoverLine = css.split('\n').find(l => l.includes(':hover'));
    assert.ok(hoverLine, 'a :hover rule must be generated');
    assert.ok(hoverLine.includes(intact), `expected the intact "${intact}" fragment, got: ${hoverLine}`);
    assert.match(hoverLine, new RegExp(`\\)\\s*:hover\\s*\\{`), 'the :hover suffix must land after the closing paren, not inside it');
  });

  test(`MIG-B6-15: @ds-input preserves "${intact}" the same way`, async () => {
    const css = await compile(`${selector.replace('.btn', '.field')} { @ds-input(outlined primary); }`);
    const focusLine = css.split('\n').find(l => l.includes(':focus') && !l.includes('focus-visible'));
    assert.ok(focusLine, 'a :focus rule must be generated');
    assert.ok(focusLine.includes(intact), `expected the intact "${intact}" fragment in: ${focusLine}`);
  });
}

test('MIG-B6-15: a multi-state, multi-suffix selector (.is-selected, [aria-pressed], [aria-selected]) keeps every functional pseudo-class intact', async () => {
  const css = await compile('.btn:is(.a, .b) { @ds-button(contained primary); }');
  const selectedLine = css.split('\n').find(l => l.includes('.is-selected'));
  assert.ok(selectedLine, 'a selected-state rule must be generated');
  assert.ok(selectedLine.includes(':is(.a, .b)'), `expected the intact functional pseudo-class in: ${selectedLine}`);
  assert.ok(!selectedLine.includes(':is(.a:'), 'a state suffix must never land inside the pseudo-class argument list');
});

test('MIG-B6-15: a plain comma-separated selector list still targets each member independently (regression control)', async () => {
  const css = await compile('.a, .b { @ds-button(contained primary); }');
  const hoverLine = css.split('\n').find(l => l.includes(':hover'));
  assert.match(hoverLine, /\.a:hover,\s*\.b:hover/);
});

for (const [selector, intact] of FUNCTIONAL_PSEUDOS) {
  test(`MIG-B6-15: @ds-surface never splits "${intact}" (no equivalent bug — declarations insert directly into the rule)`, async () => {
    const cardSelector = selector.replace('.btn', '.card');
    const css = await compile(`${cardSelector} { @ds-surface(contained); }`);
    assert.ok(css.includes(cardSelector), `expected the untouched host selector "${cardSelector}" in: ${css}`);
    assert.doesNotMatch(css, /:is\(\.x\s*\{|:where\(\.x\s*\{|:not\(\.x\s*\{|:has\(>\s*\.x\s*\{/, 'the selector must not have been split mid-pseudo-class');
  });
}
