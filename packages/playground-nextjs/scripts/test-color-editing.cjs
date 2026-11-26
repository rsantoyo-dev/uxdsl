// The Live theme handler's Colors editor: a shade of the collection, and who follows it.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { deepMergeTheme, validateTheme, generateThemeCss } = require('uxdsl/theme');
const { baseTheme } = require('../themes');
const c = require('../src/lib/color-editing');

test('a shade is read and written by family and shade, a standalone name by itself', () => {
  assert.equal(c.colorValue(baseTheme.colors, 'purple.700'), baseTheme.colors.purple['700']);
  assert.equal(c.colorValue(baseTheme.colors, 'white'), baseTheme.colors.white);
  assert.equal(c.colorValue(baseTheme.colors, 'purple.701'), undefined);
  assert.equal(c.colorValue(baseTheme.colors, 'gray'), undefined);
  assert.deepEqual(c.colorPatch('gray.500', '#123456'), { colors: { gray: { 500: '#123456' } } });
  assert.deepEqual(c.colorPatch('white', '#fefefe'), { colors: { white: '#fefefe' } });
});

test('an edited shade is a theme value the validator accepts, and the roles that name it follow', () => {
  const edited = deepMergeTheme(baseTheme, c.colorPatch('purple.700', '#6d28d9'));
  assert.equal(validateTheme(edited).ok, true);
  const css = generateThemeCss(edited);
  assert.match(css, /--uxdsl__color__purple-700: #6d28d9/);
  // primary.main is color(purple.700) in the base theme, so it reads the edited shade.
  assert.equal(baseTheme.palette.primary.main, 'color(purple.700)');
  assert.match(css, /--uxdsl__palette__primary-main: var\(--uxdsl__color__purple-700\)/);
});

test('followers: roles that name the shade, then roles linked to them, per mode', () => {
  const found = c.colorConsumers(baseTheme, 'gray.900');
  const light = Object.fromEntries(found.light.map((f) => [f.role, f.via]));
  assert.equal(light['surface.contrast'], null);
  // text.primary is palette(surface.contrast), and text.main is palette(text.primary).
  assert.equal(light['text.primary'], 'surface.contrast');
  assert.equal(light['text.main'], 'text.primary');
  // Dark mode reads modes.dark.palette over the light palette.
  assert.ok(found.dark.some((f) => f.role === 'surface.light' && f.via === null));
  assert.ok(!found.dark.some((f) => f.role === 'surface.contrast'));
  // Other families: borders.4 names color(gray.500).
  assert.deepEqual(c.colorConsumers(baseTheme, 'gray.500').other.borders, ['4']);
  assert.ok(c.followerCount(found) >= found.light.length + found.dark.length);
});

test('an alpha counts, a longer key or another function does not', () => {
  const theme = {
    palette: { a: { main: 'color(red.500, 0.5)', b: 'color(red.50)', c: 'color-mix(in srgb, red, blue)', d: 'palette(a.main, 0.2)' } },
    borders: { 1: '1px solid color(red.500)', 2: '1px solid color(red.5000)' },
  };
  const found = c.colorConsumers(theme, 'red.500');
  assert.deepEqual(found.light, [{ role: 'a.main', via: null }, { role: 'a.d', via: 'a.main' }]);
  assert.deepEqual(found.other, { borders: ['1'] });
  // Control: a shade nobody names has no followers.
  assert.equal(c.followerCount(c.colorConsumers(theme, 'red.600')), 0);
});
