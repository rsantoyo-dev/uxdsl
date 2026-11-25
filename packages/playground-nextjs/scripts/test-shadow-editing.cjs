// The Live theme handler's Shadows tab: layers split at the top level, and written back.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { deepMergeTheme, validateTheme, generateThemeCss } = require('uxdsl/theme');
const { baseTheme } = require('../themes');
const s = require('../src/lib/shadow-editing');

test('layers split at the commas outside parentheses only', () => {
  assert.deepEqual(s.splitLayers('0 1px 2px rgba(0, 0, 0, 0.06), inset 0 1px 0 palette(primary.main, 0.3)'),
    ['0 1px 2px rgba(0, 0, 0, 0.06)', 'inset 0 1px 0 palette(primary.main, 0.3)']);
});

test('a layer reads in any CSS order, and an unreadable one is null', () => {
  assert.deepEqual(s.parseLayer('0 4px 10px rgba(0, 0, 0, 0.14)'), { inset: false, x: '0', y: '4px', blur: '10px', spread: '0', color: 'rgba(0, 0, 0, 0.14)' });
  assert.deepEqual(s.parseLayer('color(black, 0.2) inset 1px 2px 3px 4px'), { inset: true, x: '1px', y: '2px', blur: '3px', spread: '4px', color: 'color(black, 0.2)' });
  assert.equal(s.parseLayer('1px'), null);
  assert.equal(s.parseLayer('1px 2px red blue'), null);
  assert.deepEqual(s.layersOf('none'), []);
  assert.equal(s.layersOf('0 1px 2px red, bogus'), null);
});

test('every base shadow round-trips through the layer editor', () => {
  for (const value of Object.values(baseTheme.shadows)) {
    const layers = s.layersOf(value);
    assert.ok(layers, value);
    assert.equal(s.buildShadow(layers), value === 'none' ? 'none' : value);
  }
});

test('a base-only value is written plain; more breakpoints are written responsive', () => {
  const order = ['xs', 'sm', 'md', 'lg', 'xl'];
  assert.equal(s.shadowDefinition({ xs: '0 1px 2px red' }, order), '0 1px 2px red');
  assert.equal(s.shadowDefinition({ xs: '0 1px 2px red', md: 'none' }, order), 'xs(0 1px 2px red) md(none)');
  assert.equal(s.shadowDefinition({ xs: '0 1px 2px red', md: '' }, order), '0 1px 2px red');
  assert.equal(s.pxOf('12px'), 12);
  assert.equal(s.pxOf('space(2)'), null);
});

test('an edited shadow is a value: it validates and moves its variable', () => {
  const value = 'xs(0 2px 6px color(black, 0.12)) md(0 8px 24px palette(primary.main, 0.3))';
  const edited = deepMergeTheme(baseTheme, { shadows: { 2: value } });
  assert.equal(validateTheme(edited).ok, true);
  assert.match(generateThemeCss(edited), /--uxdsl__shadow__2: 0 8px 24px/);
});
