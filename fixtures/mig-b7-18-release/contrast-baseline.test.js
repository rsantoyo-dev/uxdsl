'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('../../packages/postcss-uxdsl/dist/ds-runtime');
const exceptions = require('../../packages/postcss-uxdsl/src/theme/base.contrast-exceptions.json');
const baseline = require('./contrast-baseline.json');
const { assertContrastBaseline } = require('./run');

test('beta.7 contrast gate rejects an invalid exception while pinned failures stay unchanged', () => {
  const valid = runtime.checkThemeContrast(runtime.resolveTheme(), { exceptions });
  assert.match(assertContrastBaseline(valid, baseline.signatures), /known failures, unchanged/);

  const duplicate = runtime.checkThemeContrast(runtime.resolveTheme(), { exceptions: [...exceptions, ...exceptions] });
  assert.deepEqual(duplicate.failures, valid.failures, 'the negative control keeps the same ordinary failures');
  assert.match(duplicate.exceptionIssues.join(' '), /duplicate exception id/);
  assert.throws(() => assertContrastBaseline(duplicate, baseline.signatures), /contrast exceptions invalid/);
});
