const assert = require('node:assert/strict');
const { test } = require('node:test');
const { deepMergeTheme, generateThemeCss } = require('postcss-uxdsl/ds-runtime');
const { baseTheme, themes } = require('../themes');

test('every named theme inherits required roles and generates standalone runtime CSS', () => {
  for (const theme of Object.values(themes)) {
    const css = generateThemeCss(theme);
    for (const token of ['--uxdsl__palette__divider-main:', '--uxdsl__palette__text-secondary:', '--uxdsl__typography__body-sm-size:']) {
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
  assert.deepEqual(require('../uxdsl.config.cjs').theme, themes.default);
});
