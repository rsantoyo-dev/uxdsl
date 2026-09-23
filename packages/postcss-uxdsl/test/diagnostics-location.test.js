'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const postcss = require('postcss');
const plugin = require('../dist');

const file = path.join(process.cwd(), 'src', 'panel.uxdsl');

async function compile(css) {
  return postcss([plugin({ includeTheme: false })]).process(css, { from: file });
}

for (const [property, value, code] of [
  ['padding', 'density(16)', 'UXD_DENSITY_REFERENCE'],
  ['color', 'palette(primry)', 'UXD_REFERENCE_MISSING'],
  ['border-radius', 'radius(md)', 'UXD_EDGE_REFERENCE'],
]) {
  test(`MIG-B6-13: ${code} includes the declaration source location`, async () => {
    const error = await compile(`.a {\n  ${property}: ${value};\n}`).then(() => null, caught => caught);
    assert.ok(error, 'compilation fails');
    assert.equal(error.file, file);
    assert.equal(error.line, 2);
    assert.equal(typeof error.column, 'number');
    assert.match(error.message, new RegExp(code));
    if (code === 'UXD_REFERENCE_MISSING') assert.match(error.message, /Did you mean "primary"\?/);
  });
}

test('MIG-B6-13: reference warnings retain the declaration location', async () => {
  const result = await postcss([plugin({ includeTheme: false, references: { mode: 'warn' } })])
    .process('.a {\n  color: palette(primry);\n}', { from: file });
  const [warning] = result.warnings();
  assert.equal(warning.line, 2);
  assert.equal(warning.column, 3);
});

for (const [directive, code] of [
  ['@ds-button(contained primary 999);', 'UXD_SURFACE_SIZE'],
  ['@ds-surface(nonexistent);', 'UXD_SURFACE_REFERENCE'],
  ['@ds-input(contained primary 999);', 'UXD_SURFACE_SIZE'],
]) {
  test(`MIG-B6-13: ${directive} includes the directive source location`, async () => {
    const error = await compile(`.a {\n  ${directive}\n}`).then(() => null, caught => caught);
    assert.equal(error.name, 'CssSyntaxError');
    assert.equal(error.file, file);
    assert.equal(error.line, 2);
    assert.equal(typeof error.column, 'number');
    assert.match(error.reason, new RegExp(`^${code}: `));
  });
}

// MIG-B6-17 (FEAT-008) changed *which* error the @ds-typo case raises, not
// what this test is really pinning: `@ds-typo(nonexistent)` used to emit
// declarations referencing variables no theme defined, so the failure only
// surfaced downstream as a dangling-variable ReferenceIntegrityError. It now
// fails at the directive itself, naming the unknown role and listing the real
// ones. Either way the synthesized output must keep the at-rule's own source,
// so the reported position is still line 2 and not the top of the file — that
// is the regression this case exists for, and it is asserted for both.
for (const [css, line, expectedName, expectedReason] of [
  ['.a {\n  @ds-typo(nonexistent);\n}', 2, 'CssSyntaxError', /^UXD_TYPO_REFERENCE: /],
  ['.a {\n  @ds-button(contained);\n}', 2, 'ReferenceIntegrityError', undefined],
]) {
  test('MIG-B6-13: generated directive declarations retain the at-rule source', async () => {
    const theme = css.includes('ds-button')
      ? { buttons: { contained: { base: { bg: 'palette(primry)' } } } }
      : undefined;
    const error = await postcss([plugin({ includeTheme: false, theme })]).process(css, { from: file }).then(() => null, caught => caught);
    assert.equal(error.name, expectedName);
    assert.equal(error.file, file);
    assert.equal(error.line, line);
    if (expectedReason) assert.match(error.reason, expectedReason);
  });
}

// --- MIG-B6-13 code-review follow-up: theme-object errors (no CSS line to
// point at) must name the exact dotted key path that failed, not just embed
// it as free text inside the message. A prior pass added this for
// typography_details (typography.ts) but left surfaces/densities/radii
// throwing a plain, unlocated Error — reproduced with the exact theme
// snippets from that review.
for (const [theme, code, keyPath] of [
  [{ surfaces: { contained: { bogus: 'red' } } }, 'UXD_SURFACE_FIELD', 'surfaces.contained.bogus'],
  [{ surfaces: { 'bad role': {} } }, 'UXD_SURFACE_ROLE', 'surfaces.bad role'],
  [{ surfaces: 'not-an-object' }, 'UXD_SURFACE_MAP', 'surfaces'],
  [{ densities: { x: '' } }, 'UXD_DENSITY_VALUE', 'densities.x'],
  [{ densities: 'not-an-object' }, 'UXD_DENSITY_MAP', 'densities'],
  [{ radii: { '1': '' } }, 'UXD_EDGE_VALUE', 'radii.1'],
  [{ borders: { '1': '' } }, 'UXD_EDGE_VALUE', 'borders.1'],
  [{ shadows: { '1': '' } }, 'UXD_SHADOW_VALUE', 'shadows.1'],
]) {
  test(`MIG-B6-13: ${code} at "${keyPath}" carries the theme key path`, async () => {
    const error = await postcss([plugin({ includeTheme: false, theme })]).process('.a {}', { from: file }).then(() => null, caught => caught);
    assert.ok(error, 'compilation fails');
    assert.equal(error.keyPath, keyPath);
    assert.match(error.message, new RegExp(`^${code}: `));
    assert.match(error.message, new RegExp(`\\(at ${keyPath.replace(/[.[\]]/g, '\\$&')}\\)`));
  });
}

// MIG-B6-13 pending item from the story's own Pruebas section: a $var
// substitution rewrites `decl.value` in place on the same PostCSS node
// (see index.ts's "$var substitutions across all declarations" pass), so
// an invalid reference reached only through an expanded $var must still
// report the *consuming* declaration's own location, not the `$bad: ...`
// declaration that defined the variable (which is removed from the tree
// entirely before this check would even see it).
test('MIG-B6-13: an invalid reference reached through $var expansion retains the consuming declaration\'s location', async () => {
  const error = await compile('$bad: density(16);\n.a {\n  padding: $bad;\n}').then(() => null, caught => caught);
  assert.ok(error, 'compilation fails');
  assert.equal(error.file, file);
  assert.equal(error.line, 3, 'the "padding: $bad" declaration, not the "$bad: density(16)" one on line 1');
  assert.match(error.message, /UXD_DENSITY_REFERENCE/);
});

// MIG-B6-13 pending item: `locateError` sets `.cause` to the original,
// unlocated error when it wraps one into a PostCSS CssSyntaxError — nothing
// checked this before. `cause` is what lets `err.cause.keyPath`/programmatic
// inspection reach the original diagnostic even after relocation swapped
// the error's own identity (name, message shape) for PostCSS's.
test('MIG-B6-13: a located CSS error keeps the original error as .cause', async () => {
  const error = await compile('.a {\n  padding: density(16);\n}').then(() => null, caught => caught);
  assert.equal(error.name, 'CssSyntaxError');
  assert.ok(error.cause instanceof Error);
  assert.match(error.cause.message, /^UXD_DENSITY_REFERENCE: /);
});