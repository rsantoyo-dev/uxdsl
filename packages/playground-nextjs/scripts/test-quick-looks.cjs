// The Live theme handler's quick looks (src/lib/quick-looks.js): every look, over every named
// theme, is a value change applyTheme takes live, and adds no contrast failure.
const test = require('node:test');
const assert = require('node:assert/strict');
const { deepMergeTheme, resolveTheme, checkThemeContrast } = require('uxdsl/theme');
const exceptions = require('uxdsl/theme/base.contrast-exceptions.json');
const { themes } = require('../themes');
const { LOOKS, lookById, lookPatch, lookIsOn, lookOffPatch } = require('../src/lib/quick-looks.js');
const { checkPatch } = require('../src/lib/theme-patch.js');

const failures = (theme) => checkThemeContrast(resolveTheme(theme), { exceptions }).failures.map((pair) => JSON.stringify(pair)).sort();

test('every look applies live over every named theme', () => {
  for (const [name, theme] of Object.entries(themes)) {
    for (const look of LOOKS) {
      // Over the theme it starts from (the page on Green), and over another one (a look kept across a theme edit).
      for (const base of [theme, themes.default]) {
        const checked = checkPatch(theme, lookPatch(look, base));
        assert.ok(checked.ok, `${look.id} over ${name}: ${checked.message}`);
      }
    }
  }
});

test('no look adds a contrast failure', () => {
  for (const [name, theme] of Object.entries(themes)) {
    const before = new Set(failures(theme));
    for (const look of LOOKS) {
      const added = failures(deepMergeTheme(theme, lookPatch(look, theme))).filter((pair) => !before.has(pair));
      assert.deepEqual(added, [], `${look.id} over ${name}`);
    }
  }
});

// `base` is the named theme the page started from: this site's default unless said.
const on = (theme, base = themes.default) => LOOKS.filter((look) => lookIsOn(look, theme, base)).map((look) => look.id);
const press = (theme, id, base = themes.default) => deepMergeTheme(theme, lookPatch(lookById(id), base));
const release = (theme, id, base = themes.default) => deepMergeTheme(theme, lookOffPatch(lookById(id), base));

test('looks compose, and density looks shift by one step from the starting theme', () => {
  const base = themes.default;
  const compact = press(base, 'compact');
  assert.equal(compact.densities['4'], base.densities['3']);
  assert.equal(compact.densities['1'], base.densities['1'], 'density(1) stays: there is no step below it but 0');
  assert.equal(compact.densities['0'], base.densities['0']);
  const roomy = press(base, 'roomy');
  assert.equal(roomy.densities['4'], base.densities['5']);
  assert.equal(roomy.densities['15'], base.densities['15']);
  const both = press(press(base, 'rounder'), 'ocean');
  assert.equal(both.palette.primary.main, 'color(blue.700)');
  assert.equal(both.radii['2'], 'xs(space(4)) lg(space(5))');
  assert.equal(new Set(LOOKS.map((look) => look.id)).size, LOOKS.length);
});

test('which looks are on is read from the theme', () => {
  for (const [name, theme] of Object.entries(themes)) assert.deepEqual(on(theme, theme), [], `no look is on in ${name}`);
  let theme = themes.default;
  for (const id of ['rounder', 'ocean', 'compact', 'deeper']) theme = press(theme, id);
  assert.deepEqual(on(theme), ['rounder', 'compact', 'ocean', 'deeper'], 'looks of different kinds stay on together');
  // An edit in a tab that moves one of a look's tokens turns it off; the others stay.
  assert.deepEqual(on(deepMergeTheme(theme, { radii: { 2: 'space(2)' } })), ['compact', 'ocean', 'deeper']);
});

test('two looks of one kind replace each other, and pressing one twice changes nothing more', () => {
  const kinds = {};
  for (const look of LOOKS) (kinds[look.kind] ||= []).push(look.id);
  assert.deepEqual(Object.values(kinds).map((ids) => ids.length), [2, 2, 2, 2], 'four kinds, two looks each');
  for (const [first, second] of Object.values(kinds)) {
    const one = press(themes.default, first);
    assert.deepEqual(press(one, first), one, `${first} twice`);
    assert.deepEqual(on(press(one, second)), [second], `${second} replaces ${first}`);
    assert.deepEqual(press(one, second), press(themes.default, second), `${second} after ${first} is ${second} alone`);
  }
});

test('taking a look off gives back the theme the page started from, and leaves the other looks on', () => {
  for (const look of LOOKS) {
    for (const [name, theme] of Object.entries(themes)) {
      const pressed = press(theme, look.id, theme);
      assert.deepEqual(on(pressed, theme), [look.id], `${look.id} on over ${name}`);
      const checked = checkPatch(pressed, lookOffPatch(look, theme));
      assert.ok(checked.ok, `${look.id} off over ${name}: ${checked.message}`);
      assert.deepEqual(release(pressed, look.id, theme), theme, `${look.id} off over ${name} is ${name} again`);
    }
  }
  const three = press(press(press(themes.default, 'sharp'), 'teal'), 'flat');
  assert.deepEqual(on(release(three, 'teal')), ['sharp', 'flat']);
});
