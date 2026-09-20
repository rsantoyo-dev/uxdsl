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

for (const [css, line] of [
  ['.a {\n  @ds-typo(nonexistent);\n}', 2],
  ['.a {\n  @ds-button(contained);\n}', 2],
]) {
  test('MIG-B6-13: generated directive declarations retain the at-rule source', async () => {
    const theme = css.includes('ds-button')
      ? { buttons: { contained: { base: { bg: 'palette(primry)' } } } }
      : undefined;
    const error = await postcss([plugin({ includeTheme: false, theme })]).process(css, { from: file }).then(() => null, caught => caught);
    assert.equal(error.name, 'ReferenceIntegrityError');
    assert.equal(error.file, file);
    assert.equal(error.line, line);
  });
}