const assert = require('node:assert/strict');
const { test } = require('node:test');
const { deepMergeTheme, generateThemeCss } = require('uxdsl/theme');
const { baseTheme, themes } = require('../themes');

test('every named theme inherits required roles and generates standalone runtime CSS', () => {
  for (const theme of Object.values(themes)) {
    const css = generateThemeCss(theme);
    for (const token of ['--uxdsl__palette__divider-main:', '--uxdsl__palette__text-secondary:', '--uxdsl__typography__body-sm-font-size:']) {
      assert.ok(css.includes(token), token);
    }
    assert.deepEqual(theme.spacing, baseTheme.spacing);
  }
});

test('overrides preserve siblings and replace whole responsive fields and arrays', () => {
  const snapshot = JSON.stringify(baseTheme);
  const merged = deepMergeTheme(baseTheme, {
    palette: { primary: { main: '#123456' } },
    typography_details: { body: { fontSize: 'xs(1rem) md(2rem)' } },
    fonts: { google: ['Example'] },
  });
  assert.equal(merged.palette.primary.main, '#123456');
  assert.equal(merged.palette.primary.contrast, baseTheme.palette.primary.contrast);
  assert.equal(merged.typography_details.body.fontSize, 'xs(1rem) md(2rem)');
  assert.deepEqual(merged.fonts.google, ['Example']);
  assert.equal(JSON.stringify(baseTheme), snapshot);
  assert.deepEqual(require('../uxdsl.theme.cjs'), themes.default);
});

// MIG-B7-17 phase C: the named overrides declare the packaged JSON Schema as their `$schema`,
// so an editor validates and completes them. This resolves the package's own export
// (`postcss-uxdsl/schema/theme.schema.json`), checks each pointer reaches that same file, and
// that every top-level key is one the schema declares (it is `additionalProperties: false`).
// Not a full JSON Schema validation — the editor does that; this keeps the pointer honest.
test('named theme overrides point $schema at the packaged theme schema, and use only families it declares', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const schemaFile = require.resolve('uxdsl/schema/theme.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaFile, 'utf8'));
  assert.equal(schema.additionalProperties, false);
  for (const name of ['green', 'purple', 'slate']) {
    const file = path.join(__dirname, '..', `uxdsl.theme.${name}.json`);
    const override = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.ok(override.$schema, `${name}: no $schema`);
    assert.equal(fs.realpathSync(path.resolve(path.dirname(file), override.$schema)), fs.realpathSync(schemaFile), `${name}: $schema does not reach the packaged schema`);
    for (const key of Object.keys(override)) assert.ok(Object.prototype.hasOwnProperty.call(schema.properties, key), `${name}: "${key}" is not a family the schema declares`);
  }
  // The default override is intentionally empty: the default theme IS the base.
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'uxdsl.theme.default.json'), 'utf8')), {});
});
