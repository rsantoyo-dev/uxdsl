'use strict';

// MIG-B3-03 (FEAT-004): an unknown top-level theme family used to pass
// through validateAndNormalizeTheme silently — neither an error nor a
// warning — which is exactly why a theme-file/build-config collision or a
// plain typo (`color` instead of `colors`) went unnoticed until someone
// diffed compiled CSS by hand.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateAndNormalizeTheme } = require('../dist/ds-runtime/theme-validate');

test('MIG-B3-03: an unknown top-level family produces a warning, not an error', () => {
  const result = validateAndNormalizeTheme({ color: { primary: '#123456' } });
  assert.equal(result.ok, true, 'an unknown family must not fail validation');
  assert.ok(
    result.warnings.some((w) => w.path === 'color' && /Unknown theme family/.test(w.message)),
    `expected an "Unknown theme family" warning for "color"; got ${JSON.stringify(result.warnings)}`
  );
});

test('MIG-B3-03: a known family (even nested/partial) produces no unknown-family warning', () => {
  const result = validateAndNormalizeTheme({ colors: { primary: '#123456' }, fonts: { families: { ui: 'Inter' } } });
  assert.ok(
    !result.warnings.some((w) => /Unknown theme family/.test(w.message)),
    `expected no unknown-family warnings; got ${JSON.stringify(result.warnings)}`
  );
});

test('MIG-B3-03: a theme accidentally shaped like a build config (entry/outFile/watch) warns for each stray key', () => {
  const result = validateAndNormalizeTheme({ entry: './src/entry.uxdsl', outFile: './src/out.css', watch: ['src/**/*.uxdsl'] });
  const flagged = result.warnings.filter((w) => /Unknown theme family/.test(w.message)).map((w) => w.path);
  assert.deepEqual(flagged.sort(), ['entry', 'outFile', 'watch']);
});
