// The Live theme handler's palette editor: the pure part, tested directly.
// The patches it writes are checked against the real merge and validator.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { deepMergeTheme, validateTheme } = require('uxdsl/theme');
const { baseTheme } = require('../themes');
const p = require('../src/lib/palette-editing');

test('a value is a collection shade, a role or a literal', () => {
  assert.deepEqual(p.classifyValue('color(purple.700)'), { source: 'collection', key: 'purple.700' });
  assert.deepEqual(p.classifyValue('color(white)'), { source: 'collection', key: 'white' });
  assert.deepEqual(p.classifyValue('palette(secondary.main)'), { source: 'role', key: 'secondary.main' });
  assert.deepEqual(p.classifyValue('palette(secondary)'), { source: 'role', key: 'secondary.main' });
  assert.deepEqual(p.classifyValue('#7c3aed'), { source: 'free', key: null });
  // An alpha makes it a literal to the editor: it is kept as written, not re-read as the shade.
  assert.deepEqual(p.classifyValue('color(purple.700, 0.5)'), { source: 'free', key: null });
  assert.deepEqual(p.classifyValue(undefined), { source: 'free', key: null });
});

test('the color collection becomes rows, standalone names first', () => {
  const rows = p.colorRows({ white: '#fff', purple: { 200: '#a', 700: '#b' }, black: '#000' });
  assert.deepEqual(rows.map((row) => row.family), ['named', 'purple']);
  assert.deepEqual(rows[0].swatches.map((s) => s.key), ['white', 'black']);
  assert.deepEqual(rows[1].swatches.map((s) => s.key), ['purple.200', 'purple.700']);
});

test('the dark palette is modes.dark.palette over the light one, key by key', () => {
  const theme = { palette: { primary: { main: 'a', light: 'b' } }, modes: { dark: { palette: { primary: { main: 'c' } } } } };
  assert.deepEqual(p.paletteFor(theme, 'light').primary, { main: 'a', light: 'b' });
  assert.deepEqual(p.paletteFor(theme, 'dark').primary, { main: 'c', light: 'b' });
  assert.equal(p.isInherited(theme, 'primary', 'main'), false);
  assert.equal(p.isInherited(theme, 'primary', 'light'), true);
});

test('roles are grouped by purpose, every family once, an unknown one under Other', () => {
  const groups = p.roleGroups({ ...baseTheme.palette, brandish: { main: 'red' } });
  const grouped = p.groupRoles(groups);
  assert.deepEqual(grouped.map((g) => g.label), ['Brand', 'Status', 'Canvas', 'Text and lines', 'Other']);
  const families = grouped.flatMap((g) => g.roles.map((r) => r.family));
  assert.deepEqual([...families].sort(), groups.map((g) => g.family).sort());
  assert.deepEqual(grouped.at(-1).roles.map((r) => r.family), ['brandish']);
  // Control: with only known families there is no Other group.
  assert.ok(!p.groupRoles(p.roleGroups(baseTheme.palette)).some((g) => g.label === 'Other'));
});

test('a link that would come back to the edited variant is a cycle', () => {
  const palette = { primary: { main: 'palette(secondary.main)', light: 'color(purple.500)' }, secondary: { main: 'palette(primary.light)' } };
  assert.equal(p.wouldCycle(palette, 'primary.light', 'primary.main'), true);
  assert.equal(p.wouldCycle(palette, 'primary.light', 'secondary.main'), true);
  assert.equal(p.wouldCycle(palette, 'primary.main', 'primary.light'), false);
  assert.equal(p.wouldCycle(palette, 'primary.main', 'primary.main'), true);
  // Control: a reference loop elsewhere does not hang it.
  const loop = { a: { main: 'palette(b.main)' }, b: { main: 'palette(a.main)' } };
  assert.equal(p.wouldCycle(loop, 'c.main', 'a.main'), false);
});

test('each source writes a patch the real merge and validator accept, at the right path', () => {
  for (const [mode, value] of [['light', 'color(green.700)'], ['dark', 'palette(secondary.light)'], ['light', '#0ea5e9']]) {
    const patch = p.patchFor(mode, 'primary', 'main', value);
    const merged = deepMergeTheme(baseTheme, patch);
    assert.equal(validateTheme(merged).ok, true, `${mode} ${value}`);
    const written = mode === 'dark' ? merged.modes.dark.palette.primary.main : merged.palette.primary.main;
    assert.equal(written, value);
    assert.equal(p.pathFor(mode, 'primary', 'main'), mode === 'dark' ? 'modes.dark.palette.primary.main' : 'palette.primary.main');
  }
  // Writing one variant leaves the others as they were.
  const merged = deepMergeTheme(baseTheme, p.patchFor('light', 'primary', 'main', '#000000'));
  assert.equal(merged.palette.primary.contrast, baseTheme.palette.primary.contrast);
});

test('a cyclic link is refused by the validator (the editor disables it before that)', () => {
  const merged = deepMergeTheme(baseTheme, { palette: { primary: { main: 'palette(primary.light)', light: 'palette(primary.main)' } } });
  assert.equal(validateTheme(merged).ok, false);
});

test('variables, contrast and hex', () => {
  assert.equal(p.colorVar('purple.700'), 'var(--uxdsl__color__purple-700)');
  assert.equal(p.colorVar('white'), 'var(--uxdsl__color__white)');
  assert.equal(p.paletteVar('primary.main'), 'var(--uxdsl__palette__primary-main)');
  assert.equal(Number(p.contrastRatio([255, 255, 255], [0, 0, 0]).toFixed(2)), 21);
  assert.equal(Number(p.contrastRatio([255, 255, 255], [255, 255, 255]).toFixed(2)), 1);
  assert.equal(p.toHex6('#ABC'), '#aabbcc');
  assert.equal(p.toHex6('#7c3aed'), '#7c3aed');
  assert.equal(p.toHex6('rgb(0 0 0)'), null);
});
