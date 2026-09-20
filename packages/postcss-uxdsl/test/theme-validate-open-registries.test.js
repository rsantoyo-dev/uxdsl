'use strict';

// MIG-B6-01 (FEAT-007): regression coverage for the bug MIG-B5-02 shipped in
// 0.5.0-beta.5. That change added an "Unknown <family> key" warning for
// typography_details/palette/fonts.families, comparing each key a project
// declares against Object.keys(DEFAULT_THEME.<family>) — 4 palette roles, 3
// font roles, 2 typography tags. DEFAULT_THEME is a deliberately minimal,
// zero-crash fallback (see its own doc comment in default-theme.ts), not a
// catalog of every valid key, and none of these three families has a real
// closed set anywhere in the compiler: `foundations.ts`'s `namespacedVars()`
// turns any key into a CSS var for palette/fonts.families, and
// `typography.ts` validates tag names by shape only, not membership in a
// fixed list. So every project with a richer palette than the 4 built-in
// roles (or a custom font role, or a custom typography tag) saw incorrect
// "won't be compiled" warnings on every plain `uxdsl build`/`watch`, no flag
// needed. MIG-B6-01 removed that nested check entirely; these tests pin the
// fix by asserting such keys produce zero warnings, while the unrelated
// MIG-B3-03 top-level family check keeps working.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateAndNormalizeTheme } = require('../dist/ds-runtime/theme-validate');

function unknownWarnings(result) {
  return result.warnings.filter((w) => /^Unknown /.test(w.message));
}

test('MIG-B6-01: public runtime validates the README example and actual playground base', () => {
  const runtime = require('../dist/ds-runtime');
  assert.strictEqual(runtime.KNOWN_THEME_FAMILIES, require('../dist/ds-runtime/theme-validate').KNOWN_THEME_FAMILIES);
  const readme = fs.readFileSync(path.join(__dirname, '../README.md'), 'utf8');
  const section = readme.split('### Recognized theme families')[1];
  const example = section.match(/```json\s*([\s\S]*?)```/);
  assert.ok(example, 'README example must remain executable JSON');
  const base = JSON.parse(fs.readFileSync(path.join(__dirname, '../../playground-nextjs/uxdsl.theme.base.json'), 'utf8'));
  for (const theme of [JSON.parse(example[1]), base]) {
    const result = runtime.validateAndNormalizeTheme(theme);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.deepEqual(unknownWarnings(result), []);
  }
});

test('MIG-B6-01: a palette role beyond DEFAULT_THEME\'s 4 built-ins produces no warning', () => {
  const result = validateAndNormalizeTheme({
    palette: {
      secondary: { main: '#0ea5e9' },
      tertiary: { main: '#a855f7' },
      success: { main: '#16a34a' },
      info: { main: '#0284c7' },
      warning: { main: '#d97706' },
      dark: { main: '#111827' },
      light: { main: '#f9fafb' },
    },
  });
  assert.deepEqual(unknownWarnings(result), []);
});

test('MIG-B6-01: a custom fonts.families role beyond DEFAULT_THEME\'s 3 built-ins produces no warning', () => {
  const result = validateAndNormalizeTheme({ fonts: { families: { mono2: 'Fira Code' } } });
  assert.deepEqual(unknownWarnings(result), []);
});

test('MIG-B6-01: a custom typography_details tag beyond DEFAULT_THEME\'s built-ins produces no warning', () => {
  const result = validateAndNormalizeTheme({ typography_details: { footer: { fontSize: '0.8rem' } } });
  assert.deepEqual(unknownWarnings(result), []);
});

test('MIG-B6-01: the MIG-B3-03 top-level family check still catches a real typo', () => {
  const result = validateAndNormalizeTheme({ palete: { primary: { main: '#123456' } } });
  const warnings = unknownWarnings(result);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].path, 'palete');
  assert.match(warnings[0].message, /Unknown theme family "palete"/);
});

// The three names FEAT-007's MIG-B6-01 acceptance criteria call out by
// hand, in one theme, so the criterion is checkable as written rather than
// inferred from the three single-family tests above.
test('MIG-B6-01: palette.brand + fonts.families.marketing + typography_details.display-xl compile warning-free together', () => {
  const result = validateAndNormalizeTheme({
    palette: { brand: { main: '#ff5722' } },
    fonts: { families: { marketing: 'Poppins' } },
    typography_details: { 'display-xl': { fontSize: '4rem' } },
  });
  assert.deepEqual(unknownWarnings(result), []);
});

test('MIG-B6-01: modes and legacy typography compile warning-free with open registries', () => {
  const result = validateAndNormalizeTheme({
    modes: { dark: { palette: { primary: { main: '#000000' } } } },
    typography: { hero: '2rem' },
    typography_details: { lead: { fontSize: '1.25rem' } },
    palette: { brand: { main: '#ff5722' } },
    fonts: { families: { display: 'Poppins' } },
  });
  assert.deepEqual(unknownWarnings(result), []);
});

test('MIG-B6-01: a typo\'d typography field name (not tag name) is still a hard compiler error', () => {
  // Unlike a typo'd tag name (open namespace, no warning at all now) or a
  // typo'd palette/fonts.families role (same), a typo'd *field* inside a
  // tag (fontsize instead of fontSize) is still caught for real — it
  // survives validateAndNormalizeTheme's normalization untouched (that
  // step only coerces keys it already recognizes) and then fails
  // compileTypographyRules's own TYPOGRAPHY_PROPERTIES membership check
  // with a hard UXD_TYPO_FIELD error, surfaced here as a validation error.
  const result = validateAndNormalizeTheme({ typography_details: { h1: { fontsize: '2rem' } } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /UXD_TYPO_FIELD: Invalid h1\.fontsize/.test(e.message)));
});
