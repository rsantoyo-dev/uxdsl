'use strict';

// MIG-B6-26 (FEAT-008): `getCompletionContext` is a pure function (no
// `vscode` API) — this is a real `node --test` run, not an extension-host
// smoke test, matching the story's own requirement to make context
// detection testable without launching VS Code.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getCompletionContext } = require('../out/completion-context');

test('MIG-B6-26: a bare selector offers nothing', () => {
  assert.deepEqual(getCompletionContext('.card '), { kind: 'none' });
});

test('MIG-B6-26: a space in a selector does not trigger anything (no functions, no directives)', () => {
  assert.deepEqual(getCompletionContext('.card.large '), { kind: 'none' });
});

test('MIG-B6-26: a pseudo-selector\'s ":" is not mistaken for a property colon', () => {
  assert.deepEqual(getCompletionContext('.card:hover'), { kind: 'none' });
  assert.deepEqual(getCompletionContext('.card::before'), { kind: 'none' });
});

test('MIG-B6-26: inside a block comment offers nothing, even mid-word', () => {
  assert.deepEqual(getCompletionContext('/* padding: pal'), { kind: 'none' });
});

test('MIG-B6-26: inside a block comment that started on an earlier line offers nothing (multiline)', () => {
  const text = '.a {\n  /* padding: xs(1rem)\n  still inside pal';
  assert.deepEqual(getCompletionContext(text), { kind: 'none' });
});

test('MIG-B6-26: a real value after the comment closes is still detected correctly (multiline)', () => {
  const text = '.a {\n  /* a comment */\n  padding: ';
  assert.deepEqual(getCompletionContext(text), { kind: 'value' });
});

test('MIG-B6-26: inside a "//" line comment offers nothing', () => {
  assert.deepEqual(getCompletionContext('// padding: pal'), { kind: 'none' });
});

test('MIG-B6-26: a "//" line comment does not affect a later line', () => {
  const text = '// a comment\n.a { padding: ';
  assert.deepEqual(getCompletionContext(text), { kind: 'value' });
});

test('MIG-B6-26: inside a single- or double-quoted string offers nothing', () => {
  assert.deepEqual(getCompletionContext(".a::before { content: 'pal"), { kind: 'none' });
  assert.deepEqual(getCompletionContext('.a::before { content: "pal'), { kind: 'none' });
});

test('MIG-B6-26: a string containing "//" is not mistaken for a line comment (the string check wins first)', () => {
  assert.deepEqual(getCompletionContext(".a::before { content: 'https://exam"), { kind: 'none' });
});

test('MIG-B6-26: an escaped quote inside a string does not end it early', () => {
  // The cursor is still inside the string (the \' is an escaped quote,
  // not the closing one), so this must still read as "inside a string".
  assert.deepEqual(getCompletionContext(".a::before { content: 'it\\'s pal"), { kind: 'none' });
});

test('MIG-B6-26: after "padding: " offers value completions', () => {
  assert.deepEqual(getCompletionContext('.a { padding: '), { kind: 'value' });
});

test('MIG-B6-26: a custom property\'s value also offers value completions', () => {
  assert.deepEqual(getCompletionContext('.a { --my-token: '), { kind: 'value' });
});

test('MIG-B6-26: nesting — a value inside a nested rule is still detected after the outer selector\'s own colon-free text', () => {
  const text = '.a {\n  padding: space(2);\n  &:hover {\n    padding: ';
  assert.deepEqual(getCompletionContext(text), { kind: 'value' });
});

test('MIG-B6-26: after a nested rule closes, the outer rule\'s next declaration is still detected correctly', () => {
  const text = '.a {\n  &:hover {\n    color: red;\n  }\n  padding: ';
  assert.deepEqual(getCompletionContext(text), { kind: 'value' });
});

test('MIG-B6-26: "@" alone offers directives', () => {
  assert.deepEqual(getCompletionContext('.a { @'), { kind: 'directive' });
});

test('MIG-B6-26: "@" with a partial name still offers directives', () => {
  assert.deepEqual(getCompletionContext('.a { @ds-su'), { kind: 'directive' });
});

test('MIG-B6-26: "@ds-button(" offers that directive\'s arguments', () => {
  assert.deepEqual(getCompletionContext('.a { @ds-button('), { kind: 'directive-arguments', directive: 'ds-button' });
});

test('MIG-B6-26: "@ds-surface(contained " (mid-arguments) still offers that directive\'s arguments', () => {
  assert.deepEqual(getCompletionContext('.a { @ds-surface(contained '), { kind: 'directive-arguments', directive: 'ds-surface' });
});

test('MIG-B6-26: once a directive call is closed, the rest of the statement is not still "directive-arguments"', () => {
  assert.deepEqual(getCompletionContext('.a { @ds-button(contained); padding: '), { kind: 'value' });
});

test('MIG-B6-26: a directive call closed earlier in the file does not leak into a later, unrelated declaration', () => {
  const text = '.a { @ds-button(contained); }\n.b { padding: ';
  assert.deepEqual(getCompletionContext(text), { kind: 'value' });
});
