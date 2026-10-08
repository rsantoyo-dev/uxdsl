'use strict';

// Stability phase 3 (handoff 2026-10-07 §3.1, from phase 5's report): a
// disabled Button or Input must not react to the pointer. The `hover` and
// `active` state rules used to be plain `:hover`/`:active`, so a disabled
// control (`:disabled` or `[aria-disabled="true"]`) still changed color on
// hover under its dimming. Both now exclude disabled, through
// `:not(:where(…))` so the rule's specificity is what it was: an author's own
// `.btn:hover { … }` after the directive still overrides it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');

const exported = require('../dist/plugin');
const plugin = exported.default || exported;
const { resolveTheme } = require('../dist/default-theme');
const { buttonComponentCss, BUTTON_STATES } = require('../dist/buttons');
const { inputComponentCss, INPUT_STATES } = require('../dist/inputs');

const NOT_DISABLED = ':not(:where(:disabled, [aria-disabled="true"]))';
const theme = resolveTheme({
  buttons: { cta: { states: { hover: { bg: 'tone(dark)' }, active: { bg: 'tone(main)' }, disabled: { opacity: '0.5' } } } },
  inputs: { field: { states: { hover: { border: '1px solid palette(primary.main)' } } } },
});
const selectors = (css) => postcss.parse(css).nodes.filter((node) => node.type === 'rule').map((rule) => rule.selector);

test('Button hover and active exclude a disabled control; the disabled rule itself is unchanged', () => {
  const rules = selectors(buttonComponentCss(theme, '.btn', 'cta'));
  assert.ok(rules.includes(`.btn:hover${NOT_DISABLED}`), rules.join(' | '));
  assert.ok(rules.includes(`.btn:active${NOT_DISABLED}`), rules.join(' | '));
  assert.ok(rules.includes('.btn:disabled, .btn[aria-disabled="true"]'), rules.join(' | '));
  assert.ok(!rules.some((selector) => /:hover(?!:not\(:where\(:disabled)/.test(selector)), 'no bare :hover rule is left');
});

test('Input hover excludes a disabled field', () => {
  const rules = selectors(inputComponentCss(theme, '.field', 'field'));
  assert.ok(rules.includes(`.field:hover${NOT_DISABLED}`), rules.join(' | '));
  assert.ok(!rules.some((selector) => /:hover(?!:not\(:where\(:disabled)/.test(selector)));
});

test('the other states are untouched', () => {
  assert.deepEqual(BUTTON_STATES.focus, [':focus']);
  assert.deepEqual(BUTTON_STATES.focusvisible, [':focus-visible']);
  assert.deepEqual(BUTTON_STATES.disabled, [':disabled', '[aria-disabled="true"]']);
  assert.deepEqual(BUTTON_STATES.selected, ['.is-selected', '[aria-pressed="true"]', '[aria-selected="true"]']);
  assert.deepEqual(INPUT_STATES.focus, [':focus']);
  assert.deepEqual(INPUT_STATES.disabled, [':disabled', '[aria-disabled="true"]']);
});

test('each selector of a list gets the exclusion, and a functional pseudo-class is not split', () => {
  const rules = selectors(buttonComponentCss(theme, '.a, .b:is(.x, .y)', 'cta'));
  assert.ok(rules.includes(`.a:hover${NOT_DISABLED}, .b:is(.x, .y):hover${NOT_DISABLED}`), rules.join(' | '));
});

test('through the compiler, an author rule after the directive still overrides the hover rule (same specificity)', () => {
  const css = postcss([plugin({ discoverTheme: false, includeTheme: false, theme: { buttons: theme.buttons } })])
    .process('.btn { @ds-button(cta); }\n.btn:hover { background: red; }', { from: undefined }).css;
  const rules = selectors(css);
  const generated = rules.indexOf(`.btn:hover${NOT_DISABLED}`);
  const author = rules.lastIndexOf('.btn:hover');
  assert.ok(generated !== -1 && author > generated, rules.join(' | '));
  // `:not(:where(…))` contributes no specificity: the generated rule is (0,2,0), like `.btn:hover`.
  assert.match(rules[generated], /:not\(:where\(/);
});
