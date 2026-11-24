// The Live theme handler's Density tab: the part that is not the library's.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { responsiveEntries, resolveResponsiveValue } = require('uxdsl/language');
const { getDensityTokens } = require('uxdsl/engine');
const { deepMergeTheme, validateTheme } = require('uxdsl/theme');
const { baseTheme } = require('../themes');
const d = require('../src/lib/density-editing');

const bps = baseTheme.breakpoints;
const order = Object.keys(bps).sort((a, b) => bps[a] - bps[b]);

test('a spacing value in pixels: space(n) through the theme, rem at 16px, px, 0; the rest is not drawn', () => {
  const spacing = { 0: '0', 3: '0.5rem', 5: '1rem', 9: '3.125rem', x: 'calc(1rem + 2px)' };
  assert.equal(d.lengthPx('space(3)', spacing), 8);
  assert.equal(d.lengthPx('space(9)', spacing), 50);
  assert.equal(d.lengthPx('space(0)', spacing), 0);
  assert.equal(d.lengthPx('12px', spacing), 12);
  assert.equal(d.lengthPx('1.5rem', spacing), 24);
  assert.equal(d.lengthPx('space(x)', spacing), null);
  assert.equal(d.lengthPx('space(99)', spacing), null);
  assert.equal(d.lengthPx('var(--a)', spacing), null);
});

test('the definition is rebuilt in breakpoint order, an empty breakpoint keeping the previous value', () => {
  assert.equal(d.buildDefinition({ xs: 'space(3)', md: 'space(4)', xl: 'space(5)' }, order), 'xs(space(3)) md(space(4)) xl(space(5))');
  assert.equal(d.buildDefinition({ md: 'space(4)', xs: 'space(3)', sm: '' }, order), 'xs(space(3)) md(space(4))');
});

test('round trip through the library: what responsiveEntries reads, buildDefinition writes back, and it resolves per breakpoint', () => {
  const tokens = getDensityTokens(baseTheme);
  for (const key of d.densityKeys(tokens)) {
    const entries = responsiveEntries(tokens[key], bps);
    const rebuilt = d.buildDefinition(entries, order);
    for (const bp of order) assert.equal(resolveResponsiveValue(rebuilt, bp, bps), resolveResponsiveValue(tokens[key], bp, bps), `densities.${key} at ${bp}`);
  }
  assert.equal(resolveResponsiveValue(tokens['4'], 'lg', bps), 'space(5)'); // md persists through lg
});

test('an edited definition is a theme value the validator accepts', () => {
  const theme = deepMergeTheme(baseTheme, { densities: { 4: d.buildDefinition({ xs: 'space(2)', lg: 'space(7)' }, order) } });
  assert.equal(validateTheme(theme).ok, true);
  assert.deepEqual(d.densityKeys({ 10: 'a', 2: 'b', 0: 'c' }), ['0', '2', '10']);
});
