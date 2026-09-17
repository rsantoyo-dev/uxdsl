'use strict';

// MIG-B5-02 (FEAT-006): completeness isn't the right question for a family
// whose whole design is per-key partial override (typography_details,
// palette, fonts.families — see MIG-B5-01's own uxdsl-cli-side reasoning
// for why --strict-theme can't check those unconditionally either), but a
// key that doesn't exist ANYWHERE in the known set for that family (a
// typo'd tag/role name) is a real mistake no amount of intentional partial
// override excuses. This is the complementary, typo-catching protection
// for those families, reusing DEFAULT_THEME's own already-merged key sets
// so the known set can never drift out of sync with the actual defaults.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateAndNormalizeTheme } = require('../dist/ds-runtime/theme-validate');
const { DEFAULT_THEME } = require('../dist/default-theme');

function unknownWarnings(result) {
  return result.warnings.filter((w) => /^Unknown /.test(w.message));
}

test('MIG-B5-02: a typo\'d typography_details tag produces a warning, not an error', () => {
  const result = validateAndNormalizeTheme({ typography_details: { h9: { fontSize: '1rem' } } });
  assert.equal(result.ok, true, 'an unknown nested key must not fail validation');
  const warnings = unknownWarnings(result);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].path, 'typography_details.h9');
  assert.match(warnings[0].message, /Unknown typography_details key "h9"/);
});

test('MIG-B5-02: a typo\'d palette role produces a warning naming it', () => {
  const result = validateAndNormalizeTheme({ palette: { primry: { main: '#ffffff' } } });
  const warnings = unknownWarnings(result);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].path, 'palette.primry');
});

test('MIG-B5-02: a typo\'d fonts.families role produces a warning naming it', () => {
  const result = validateAndNormalizeTheme({ fonts: { families: { boldface: 'Arial' } } });
  const warnings = unknownWarnings(result);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].path, 'fonts.families.boldface');
});

test('MIG-B5-02: every real key of all three families produces zero unknown-key warnings, including default-theme.ts\'s own additions', () => {
  const result = validateAndNormalizeTheme({
    typography_details: {
      ...Object.fromEntries(Object.keys(DEFAULT_THEME.typography_details).map((tag) => [tag, { fontSize: '1rem' }])),
    },
    palette: Object.fromEntries(Object.keys(DEFAULT_THEME.palette).map((role) => [role, { main: '#123456' }])),
    fonts: { families: Object.fromEntries(Object.keys(DEFAULT_THEME.fonts.families).map((role) => [role, 'Inter'])) },
  });
  assert.deepEqual(unknownWarnings(result), []);
  // Specifically confirm the two tags default-theme.ts adds on top of
  // typography-defaults.ts's own set (MIG-B2-02) are recognized, not just
  // tags typography-defaults.ts already knew about.
  assert.ok(Object.keys(DEFAULT_THEME.typography_details).includes('code'));
  assert.ok(Object.keys(DEFAULT_THEME.typography_details).includes('default'));
});

test('MIG-B5-02: a family the project never touched produces no nested-key warnings at all', () => {
  const result = validateAndNormalizeTheme({ spacing: { 4: '10px' } });
  assert.deepEqual(unknownWarnings(result), []);
});

test('MIG-B5-02: an unrelated top-level typo still only produces the MIG-B3-03 top-level warning, not a nested one', () => {
  const result = validateAndNormalizeTheme({ pallete: { primary: { main: '#123456' } } });
  assert.deepEqual(unknownWarnings(result).map((w) => w.path), ['pallete']);
});
