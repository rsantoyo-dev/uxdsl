'use strict';

// MIG-B6-14 (FEAT-008): a directive at-rule that no directive handler
// consumed used to reach the compiled CSS untouched (a browser silently
// discards any at-rule it doesn't recognize), whether because it was
// misspelled, aliased to something that was never implemented, or used at
// the document root/nested inside another at-rule instead of as a direct
// child of the rule it styles. index.ts's final catch-all `walkAtRules`
// pass now rejects every one of those with UXD_DIRECTIVE_UNKNOWN (name
// doesn't exist) or UXD_DIRECTIVE_CONTEXT (name exists, wrong position).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const postcss = require('postcss');
const plugin = require('../dist');

const file = path.join(process.cwd(), 'src', 'panel.uxdsl');

async function compileFail(css) {
  return postcss([plugin({ includeTheme: false })]).process(css, { from: file }).then(() => null, caught => caught);
}

test('MIG-B6-14: a directive at the document root fails as UXD_DIRECTIVE_CONTEXT, not silently discarded', async () => {
  const error = await compileFail('@ds-surface(contained);');
  assert.ok(error, 'compilation fails');
  assert.match(error.message, /^postcss-uxdsl: .*UXD_DIRECTIVE_CONTEXT: /);
  assert.equal(error.file, file);
  assert.equal(error.line, 1);
});

test('MIG-B6-14: a directive nested inside @media under its rule fails as UXD_DIRECTIVE_CONTEXT', async () => {
  const error = await compileFail('.a { @media (min-width: 10px) { @ds-surface(outlined primary); } }');
  assert.ok(error, 'compilation fails');
  assert.match(error.message, /UXD_DIRECTIVE_CONTEXT: /);
  assert.equal(error.line, 1);
});

test('MIG-B6-14: a directive nested inside @supports under its rule fails the same way as @media', async () => {
  const error = await compileFail('.a { @supports (display: grid) { @ds-surface(contained); } }');
  assert.ok(error, 'compilation fails');
  assert.match(error.message, /UXD_DIRECTIVE_CONTEXT: /);
});

test('MIG-B6-14: a misspelled directive fails as UXD_DIRECTIVE_UNKNOWN with a "did you mean" suggestion', async () => {
  const error = await compileFail('.a { @ds-surfce(contained); }');
  assert.ok(error, 'compilation fails');
  assert.match(error.message, /UXD_DIRECTIVE_UNKNOWN: Unknown directive @ds-surfce\. Did you mean @ds-surface\?/);
});

test('MIG-B6-14: @ds-h1 and @ds(h1) — the aliases the old comment claimed existed — fail as UXD_DIRECTIVE_UNKNOWN, no suggestion', async () => {
  const bareAlias = await compileFail('.a { @ds-h1; }');
  assert.ok(bareAlias, 'compilation fails');
  assert.match(bareAlias.message, /UXD_DIRECTIVE_UNKNOWN: Unknown directive @ds-h1\.$/m);

  const parenAlias = await compileFail('.a { @ds(h1); }');
  assert.ok(parenAlias, 'compilation fails');
  assert.match(parenAlias.message, /UXD_DIRECTIVE_UNKNOWN: Unknown directive @ds\.$/m);
});

test('MIG-B6-14: a bare @ds (the reserved namespace itself, no suffix) fails as UXD_DIRECTIVE_UNKNOWN', async () => {
  const error = await compileFail('.a { @ds; }');
  assert.ok(error, 'compilation fails');
  assert.match(error.message, /UXD_DIRECTIVE_UNKNOWN: Unknown directive @ds\./);
});

// Positive controls: every directive form the plugin actually supports must
// keep compiling — this guard must not turn into a false-positive machine.
test('MIG-B6-14 (positive control): @ds-surface/@ds-button/@ds-input/@ds-typo as direct children of their rule still compile', async () => {
  const theme = { palette: { primary: { main: '#123', dark: '#111', contrast: '#fff' }, surface: { main: '#fff', dark: '#eee', contrast: '#000' }, neutral: { main: '#999' } } };
  for (const css of [
    '.a { @ds-surface(contained); }',
    '.a { @ds-button(contained); }',
    '.a { @ds-input(contained); }',
    '.a { @ds-typo(h1); }',
  ]) {
    const result = await postcss([plugin({ includeTheme: false, theme })]).process(css, { from: file });
    assert.ok(result.css.length > 0, `${css} must still compile to non-empty CSS`);
  }
});

test('MIG-B6-14 (positive control): a rule nested inside a top-level @media, with its OWN directive as a direct child, still compiles', async () => {
  // Distinguishes "directive nested under a rule that is itself inside
  // @media" (fine — the rule's own selector still resolves to one ruleset)
  // from "directive nested inside an @media that is inside the rule"
  // (rejected above) — same two at-rules, different nesting order.
  const theme = { palette: { primary: { main: '#123', dark: '#111', contrast: '#fff' }, surface: { main: '#fff', dark: '#eee', contrast: '#000' }, neutral: { main: '#999' } } };
  const result = await postcss([plugin({ includeTheme: false, theme })])
    .process('@media (min-width: 10px) { .a { @ds-surface(contained); } }', { from: file });
  assert.ok(result.css.length > 0);
  assert.doesNotMatch(result.css, /@ds-surface/);
});
