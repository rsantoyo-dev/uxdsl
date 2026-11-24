// The Live theme handler's Spacing editor: who follows a step of the spacing scale.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { responsiveEntries } = require('uxdsl/language');
const { deepMergeTheme, validateTheme, generateThemeCss } = require('uxdsl/theme');
const { baseTheme } = require('../themes');
const s = require('../src/lib/spacing-editing');

const bps = baseTheme.breakpoints;
const consumers = (key, theme = baseTheme) => s.spacingConsumers(theme, key, bps, responsiveEntries);

test('space(4) is followed by densities at the breakpoints that name it, and by radii, borders and typography', () => {
  const found = consumers('4');
  // densities.4 is xs(space(4)) md(space(5)) xl(space(6)): only xs names space(4).
  assert.deepEqual(found.densities.find((c) => c.path === '4'), { path: '4', breakpoints: ['xs'] });
  // densities.2 is xs(space(2)) md(space(3)) xl(space(4)): xl.
  assert.deepEqual(found.densities.find((c) => c.path === '2'), { path: '2', breakpoints: ['xl'] });
  assert.ok(found.radii.some((c) => c.path === '3'));
  assert.ok(found.borders.some((c) => c.path === '5'));
  assert.ok(found.typography_details.some((c) => c.path === 'caption.fontSize'));
  assert.ok(s.consumerCount(found) > 5);
  // Control: no family that cannot name space() is listed, and space(4) does not match space(40).
  for (const family of ['spacing', 'colors', 'palette', 'breakpoints']) assert.equal(found[family], undefined);
  assert.deepEqual(consumers('4', { densities: { a: 'xs(space(40))' } }), {});
});

test('an edited step is a theme value the validator accepts, and its consumers move with it', () => {
  const edited = deepMergeTheme(baseTheme, { spacing: { 4: '0.875rem' } });
  assert.equal(validateTheme(edited).ok, true);
  assert.match(generateThemeCss(edited), /--uxdsl__space__4: 0\.875rem/);
  // A density that names it still points at the variable, so it follows without its own edit.
  assert.match(generateThemeCss(edited), /--uxdsl__density__4: var\(--uxdsl__space__4\)/);
});
