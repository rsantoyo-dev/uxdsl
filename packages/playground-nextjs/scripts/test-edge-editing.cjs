// The Live theme handler's Borders / Radii tab: splitting a Border, finding who names a token.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { deepMergeTheme, validateTheme, generateThemeCss } = require('uxdsl/theme');
const { baseTheme } = require('../themes');
const e = require('../src/lib/edge-editing');

test('a Border splits into width, style and color, the commas inside a color kept', () => {
  assert.deepEqual(e.parseBorder('space(1) solid color(gray.300)'), { width: 'space(1)', style: 'solid', color: 'color(gray.300)' });
  assert.deepEqual(e.parseBorder('2px dashed palette(primary.main, 0.5)'), { width: '2px', style: 'dashed', color: 'palette(primary.main, 0.5)' });
  assert.equal(e.parseBorder('none'), null);
  assert.equal(e.parseBorder('solid 2px red'), null);
  assert.equal(e.buildBorder({ width: '2px', style: 'dotted', color: 'color(red.500)' }), '2px dotted color(red.500)');
});

test('keys come in numeric order', () => {
  assert.deepEqual(e.edgeKeys({ 10: 'a', 2: 'b', 0: 'c', card: 'd' }), ['0', '2', '10', 'card']);
});

test('the theme values that name radius(2) are found, and not radius(20)', () => {
  const found = e.edgeConsumers(baseTheme, 'radii', '2');
  assert.ok(found.includes('surfaces.contained.radius'));
  const theme = deepMergeTheme(baseTheme, { surfaces: { outlined: { radius: 'radius(20)' } } });
  assert.ok(!e.edgeConsumers(theme, 'radii', '2').includes('surfaces.outlined.radius'));
  // The family itself is not a consumer.
  assert.ok(e.edgeConsumers(baseTheme, 'borders', '1').every((path) => !path.startsWith('borders.')));
});

test('an edited token is a value: it validates and moves its variable', () => {
  const value = 'xs(2px dashed palette(primary.main)) md(space(2) solid color(gray.500))';
  const edited = deepMergeTheme(baseTheme, e.edgePatch('borders', '1', value));
  assert.equal(validateTheme(edited).ok, true);
  const css = generateThemeCss(edited);
  assert.match(css, /--uxdsl__border__1: 2px dashed var\(--uxdsl__palette__primary-main\)/);
  const bad = deepMergeTheme(baseTheme, e.edgePatch('radii', '2', 'xs(space(99))'));
  assert.equal(validateTheme(bad).ok, false);
});

test('the colors a Border can name: Palette roles first, then the collection', () => {
  const groups = e.borderColorOptions(baseTheme);
  assert.equal(groups[0].label, 'Palette');
  assert.ok(groups[0].values.includes('palette(primary.main)'));
  assert.ok(groups.some((group) => group.values.includes('color(gray.300)')));
  assert.ok(groups.some((group) => group.values.includes('color(white)')));
});
