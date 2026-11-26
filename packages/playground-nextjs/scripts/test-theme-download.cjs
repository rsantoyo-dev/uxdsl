// The Live theme handler's download (src/lib/theme-download.js): the file merged over the
// packaged base gives back the theme on the page, for every named theme and for an edit.
const test = require('node:test');
const assert = require('node:assert/strict');
const { deepMergeTheme, validateTheme, resolveTheme } = require('uxdsl/theme');
const packagedBase = require('uxdsl/theme/base.json');
const { themes } = require('../themes');
const { SCHEMA, themeDiff, themeFamilies, themeFile, themeFileText, leafCount } = require('../src/lib/theme-download.js');

const withoutSchema = ({ $schema, ...rest }) => rest;
const roundTrip = (file) => deepMergeTheme(packagedBase, withoutSchema(file));

test('every named theme comes back from its file, which the validator accepts', () => {
  for (const [name, theme] of Object.entries(themes)) {
    const file = themeFile(theme);
    assert.equal(file.$schema, SCHEMA, name);
    assert.deepEqual(roundTrip(file), themeFamilies(theme), name);
    const checked = validateTheme(file);
    assert.ok(checked.ok, `${name}: ${JSON.stringify(checked.errors)}`);
  }
});

test('the file holds only what differs from the packaged base', () => {
  assert.deepEqual(withoutSchema(themeFile(packagedBase)), {});
  const edited = deepMergeTheme(themes.default, {
    palette: { primary: { main: 'color(blue.500)' } },
    breakpoints: { md: 800 },
    modes: { dark: { palette: { primary: { main: 'color(blue.200)' } } } },
  });
  const file = themeFile(edited);
  assert.equal(file.palette.primary.main, 'color(blue.500)');
  assert.equal(file.palette.primary.contrast, undefined, 'an unchanged sibling stays out');
  assert.deepEqual(file.breakpoints, { md: 800 });
  assert.deepEqual(file.modes, { dark: { palette: { primary: { main: 'color(blue.200)' } } } });
  assert.equal(file.shadows, undefined, 'an untouched family stays out');
  assert.deepEqual(roundTrip(file), themeFamilies(edited));
});

test('the compiler resolves the file to the theme on the page', () => {
  const edited = deepMergeTheme(themes.green, { buttons: { contained: { states: { hover: { bg: 'tone(dark)' } } } } });
  assert.deepEqual(resolveTheme(withoutSchema(themeFile(edited))), resolveTheme(themeFamilies(edited)));
});

test('page state is not theme, and full writes every family', () => {
  const theme = { ...themes.default, backgroundImage: 'abstract purple curves' };
  assert.equal(themeFile(theme).backgroundImage, undefined);
  const full = themeFile(theme, { full: true });
  assert.deepEqual(withoutSchema(full), themeFamilies(themes.default));
  assert.ok(themeFileText(theme).endsWith('}\n'));
  assert.ok(themeFileText(theme).startsWith('{\n  "$schema"'));
});

test('diff and leaf count', () => {
  assert.deepEqual(themeDiff({ a: { b: 'x', c: 'y' } }, { a: { b: 'x', c: 'z' }, d: 'w' }), { a: { c: 'z' }, d: 'w' });
  assert.equal(leafCount({ $schema: 's', a: { c: 'z' }, d: 'w' }), 2);
});
