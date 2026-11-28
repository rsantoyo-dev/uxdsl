// The Live theme handler's quick looks (src/lib/quick-looks.js): every level of every dial
// and every look, over every named theme, is a value change applyTheme takes live, and adds
// no contrast failure.
const test = require('node:test');
const assert = require('node:assert/strict');
const { deepMergeTheme, resolveTheme, checkThemeContrast } = require('uxdsl/theme');
const exceptions = require('uxdsl/theme/base.contrast-exceptions.json');
const { themes } = require('../themes');
const { DIALS, HOME, TOP, dialById, dialPatch, dialLevel, dialStep, dialHint, LOOKS, lookById, lookPatch, lookIsOn, lookOffPatch } = require('../src/lib/quick-looks.js');
const { checkPatch } = require('../src/lib/theme-patch.js');
const { FONT_PRESETS, fontPresetPatch, presetOf } = require('../src/lib/typography-editing.js');

const failures = (theme) => checkThemeContrast(resolveTheme(theme), { exceptions }).failures.map((pair) => JSON.stringify(pair)).sort();
const LEVELS = Array.from({ length: TOP + 1 }, (_, level) => level);

/** Every patch a shortcut can write over `base`: [name, patch]. */
const patches = (base) => [
  ...DIALS.flatMap((dial) => LEVELS.map((level) => [`${dial.id} ${level}`, dialPatch(dial, base, level)])),
  ...LOOKS.map((look) => [look.id, lookPatch(look, base)]),
];

test('every level and every look applies live over every named theme', () => {
  for (const [name, theme] of Object.entries(themes)) {
    // Over the theme it starts from (the page on Green), and over another one (a look kept across a theme edit).
    for (const base of [theme, themes.default]) {
      for (const [id, patch] of patches(base)) {
        const checked = checkPatch(theme, patch);
        assert.ok(checked.ok, `${id} over ${name}: ${checked.message}`);
      }
    }
  }
});

test('no level and no look adds a contrast failure', () => {
  for (const [name, theme] of Object.entries(themes)) {
    const before = new Set(failures(theme));
    for (const [id, patch] of patches(theme)) {
      const added = failures(deepMergeTheme(theme, patch)).filter((pair) => !before.has(pair));
      assert.deepEqual(added, [], `${id} over ${name}`);
    }
  }
});

// `base` is the named theme the page started from: this site's default unless said.
const levels = (theme, base = themes.default) => Object.fromEntries(DIALS.map((dial) => [dial.id, dialLevel(dial, theme, base)]));
const turn = (theme, id, direction, base = themes.default) => {
  const next = dialStep(dialById(id), theme, base, direction);
  return next ? deepMergeTheme(theme, next.patch) : theme;
};
const setLevel = (theme, id, level, base = themes.default) => deepMergeTheme(theme, dialPatch(dialById(id), base, level));
const on = (theme, base = themes.default) => LOOKS.filter((look) => lookIsOn(look, theme, base)).map((look) => look.id);
const press = (theme, id, base = themes.default) => deepMergeTheme(theme, lookPatch(lookById(id), base));
const release = (theme, id, base = themes.default) => deepMergeTheme(theme, lookOffPatch(lookById(id), base));

const ALL_HOME = { round: 2, space: 2, text: 2, border: 2, shadow: 2 };

test('five dials, six levels each, and every named theme starts at 2', () => {
  assert.deepEqual(DIALS.map((dial) => dial.id), Object.keys(ALL_HOME));
  assert.equal(HOME, 2);
  assert.equal(TOP, 5);
  for (const dial of DIALS) {
    // A shift moves by places (0 is the theme itself), a scale multiplies (1 is the theme itself).
    const amounts = dial.kind === 'shift' ? dial.by : dial.times;
    assert.equal(amounts.length, TOP + 1, dial.id);
    assert.equal(amounts[HOME], dial.kind === 'shift' ? 0 : 1, dial.id);
    assert.deepEqual([...amounts].sort((a, b) => a - b), amounts, `${dial.id}: a higher level is more`);
    assert.equal(new Set(amounts).size, amounts.length, dial.id);
    if (dial.kind === 'scale') {
      // The reason Space is a scale: no step is more than a fifth more or less than the one before.
      for (let level = 1; level <= TOP; level += 1) assert.ok(amounts[level] / amounts[level - 1] < 1.22, `${dial.id} ${level}`);
      assert.ok(dial.nudge[0] < 1 && dial.nudge[1] > 1, dial.id);
    }
  }
  for (const [name, theme] of Object.entries(themes)) {
    assert.deepEqual(levels(theme, theme), ALL_HOME, name);
    for (const dial of DIALS) {
      assert.deepEqual(deepMergeTheme(theme, dialPatch(dial, theme, HOME)), theme, `${dial.id} at 2 over ${name} writes the theme's own values`);
      // Six different sets of values: the level read back is the one that was set.
      for (const level of LEVELS) assert.equal(dialLevel(dial, setLevel(theme, dial.id, level, theme), theme), level, `${dial.id} ${level} over ${name}`);
    }
  }
});

test('a shift level is the starting theme moved along its own scale', () => {
  const base = themes.default;
  const round4 = setLevel(base, 'round', 4);
  assert.equal(round4.radii['1'], base.radii['3']);
  assert.equal(round4.radii['4'], base.radii['5'], 'past the top of the scale a token takes the top');
  assert.equal(round4.radii['0'], base.radii['0'], 'the zero token is never written');
  const round0 = setLevel(base, 'round', 0);
  for (const key of ['1', '2', '3', '4', '5']) assert.equal(round0.radii[key], base.radii['0'], 'Round 0 is square');
  const shadow0 = setLevel(base, 'shadow', 0);
  for (const key of ['1', '2', '3', '4', '5']) assert.equal(shadow0.shadows[key], 'none', 'Shadow 0 is flat');
  assert.equal(setLevel(base, 'shadow', 1).shadows['1'], 'none');
  assert.equal(setLevel(base, 'shadow', 5).shadows['2'], base.shadows['5']);
  const border0 = setLevel(base, 'border', 0);
  for (const key of ['1', '2', '3', '4', '5']) assert.equal(border0.borders[key], 'none', 'Border 0 is no border');
  assert.equal(setLevel(base, 'border', 3).borders['1'], base.borders['2']);
  assert.equal(setLevel(base, 'border', 1).borders['2'], base.borders['1']);
});

test('a scale level keeps every value and multiplies it, breakpoint by breakpoint', () => {
  const base = themes.default;
  assert.equal(base.densities['4'], 'xs(space(4)) md(space(5)) xl(space(6))');
  const space3 = setLevel(base, 'space', 3);
  assert.equal(space3.densities['4'], 'xs(calc(space(4) * 1.15)) md(calc(space(5) * 1.15)) xl(calc(space(6) * 1.15))');
  assert.equal(space3.densities['0'], base.densities['0'], 'the zero token is never written');
  assert.deepEqual(Object.keys(space3.densities), Object.keys(base.densities));
  assert.equal(setLevel(base, 'space', 0).densities['1'], 'xs(calc(space(1) * 0.7)) md(calc(space(2) * 0.7)) xl(calc(space(3) * 0.7))');
  // Spacing itself is not touched: space(n) and what is built from it by hand keep their size.
  assert.deepEqual(space3.spacing, base.spacing);

  const text1 = setLevel(base, 'text', 1);
  assert.equal(base.typography_details.h1.fontSize, 'xs(space(7)) md(space(8)) lg(space(9)) xl(space(10))');
  assert.equal(text1.typography_details.h1.fontSize, 'xs(calc(space(7) * 0.925)) md(calc(space(8) * 0.925)) lg(calc(space(9) * 0.925)) xl(calc(space(10) * 0.925))');
  assert.equal(text1.typography_details.default.fontSize, 'xs(calc(space(5) * 0.925))');
  for (const [role, fields] of Object.entries(base.typography_details)) {
    // No field is added to a role (that would be a structural change), and only the size moves.
    assert.deepEqual(Object.keys(text1.typography_details[role]), Object.keys(fields), role);
    assert.deepEqual({ ...text1.typography_details[role], fontSize: fields.fontSize }, fields, role);
  }
});

test('− and + walk the levels, stop at 0 and 5, and come back to the starting theme', () => {
  for (const [name, base] of Object.entries(themes)) {
    for (const dial of DIALS) {
      let theme = base;
      for (const expected of [3, 4, 5]) {
        theme = turn(theme, dial.id, 1, base);
        assert.equal(dialLevel(dial, theme, base), expected, `${dial.id} + over ${name}`);
      }
      assert.equal(dialStep(dial, theme, base, 1), null, `${dial.id} stops at 5`);
      for (const expected of [4, 3, 2, 1, 0]) {
        theme = turn(theme, dial.id, -1, base);
        assert.equal(dialLevel(dial, theme, base), expected, `${dial.id} − over ${name}`);
        if (expected === HOME) assert.deepEqual(theme, base, `${dial.id} back at 2 is ${name} again`);
      }
      assert.equal(dialStep(dial, theme, base, -1), null, `${dial.id} stops at 0`);
      assert.deepEqual(turn(turn(theme, dial.id, 1, base), dial.id, 1, base), base, `${dial.id} from 0 back to 2 is ${name} again`);
    }
  }
});

test('dials and looks compose, and each is read from the theme', () => {
  for (const [name, theme] of Object.entries(themes)) assert.deepEqual(on(theme, theme), [], `no look is on in ${name}`);
  let theme = themes.default;
  theme = turn(turn(theme, 'round', 1), 'round', 1);
  theme = press(theme, 'ocean');
  theme = turn(theme, 'space', -1);
  theme = turn(theme, 'shadow', 1);
  theme = turn(theme, 'text', 1);
  theme = turn(theme, 'border', -1);
  const set = { round: 4, space: 1, text: 3, border: 1, shadow: 3 };
  assert.deepEqual(levels(theme), set);
  assert.deepEqual(on(theme), ['ocean']);
  assert.equal(theme.palette.primary.main, 'color(blue.700)');
  assert.equal(theme.radii['2'], themes.default.radii['4']);
  // Taking the brand off leaves the dials where they are.
  assert.deepEqual(levels(release(theme, 'ocean')), set);
  assert.deepEqual(on(release(theme, 'ocean')), []);
});

test('after an edit by hand a dial has no level, and steps from the values on the page', () => {
  const base = themes.default;
  const edited = deepMergeTheme(turn(base, 'shadow', 1), { radii: { 2: 'space(5)' } });
  assert.deepEqual(levels(edited), { ...ALL_HOME, round: null, shadow: 3 }, 'only the edited family loses its level');
  const round = dialById('round');
  const up = dialStep(round, edited, base, 1);
  assert.equal(up.level, null);
  assert.equal(up.patch.radii['1'], 'space(5)', 'radius(1) takes the edited radius(2)');
  assert.equal(up.patch.radii['2'], base.radii['3']);
  assert.ok(checkPatch(edited, up.patch).ok);
  const down = dialStep(round, edited, base, -1);
  assert.equal(down.patch.radii['3'], 'space(5)');
  assert.equal(down.patch.radii['1'], base.radii['0']);
  // Stepped down far enough, every corner is the zero token's: a level again, and + works from it.
  let theme = edited;
  for (let i = 0; i < 6; i += 1) theme = turn(theme, 'round', -1);
  assert.equal(dialLevel(round, theme, base), 0);
  assert.equal(dialStep(round, theme, base, -1), null);
  assert.equal(dialLevel(round, turn(theme, 'round', 1), base), 1);
});

test('after an edit by hand a scale dial multiplies the values on the page', () => {
  const base = themes.default;
  const space = dialById('space');
  const edited = deepMergeTheme(base, { densities: { 4: 'xs(space(9))', 5: '0' } });
  assert.equal(dialLevel(space, edited, base), null);
  const up = dialStep(space, edited, base, 1);
  assert.equal(up.level, null);
  assert.equal(up.patch.densities['4'], 'xs(calc(space(9) * 1.15))', 'the edit is kept, and grows with the rest');
  assert.equal(up.patch.densities['5'], '0', 'a zero stays a zero');
  assert.equal(up.patch.densities['3'], 'xs(calc(space(3) * 1.15)) md(calc(space(4) * 1.15)) xl(calc(space(5) * 1.15))');
  assert.ok(checkPatch(edited, up.patch).ok);
  const down = dialStep(space, edited, base, -1);
  assert.equal(down.patch.densities['4'], 'xs(calc(space(9) * 0.87))');
  assert.ok(checkPatch(edited, down.patch).ok);
  // A second step multiplies what the first left: still a value the theme takes live.
  const twice = dialStep(space, deepMergeTheme(edited, up.patch), base, 1);
  assert.equal(twice.patch.densities['4'], 'xs(calc(calc(space(9) * 1.15) * 1.15))');
  assert.ok(checkPatch(deepMergeTheme(edited, up.patch), twice.patch).ok);

  const text = dialById('text');
  const sized = deepMergeTheme(base, { typography_details: { h1: { fontSize: 'xs(3rem)' } } });
  assert.equal(dialLevel(text, sized, base), null);
  const larger = dialStep(text, sized, base, 1);
  assert.equal(larger.patch.typography_details.h1.fontSize, 'xs(calc(3rem * 1.075))');
  assert.deepEqual(Object.keys(larger.patch.typography_details.h1), ['fontSize']);
  assert.ok(checkPatch(sized, larger.patch).ok);
});

test('the font list writes fonts.families.ui with a preset the theme takes live', () => {
  for (const [name, theme] of Object.entries(themes)) {
    for (const preset of FONT_PRESETS) {
      const patch = fontPresetPatch(theme.fonts, 'ui', preset);
      const checked = checkPatch(theme, patch);
      assert.ok(checked.ok, `${preset.name} over ${name}: ${checked.message}`);
      const next = deepMergeTheme(theme, patch);
      assert.equal(presetOf(next.fonts.families.ui), preset, `${preset.name} over ${name}`);
      assert.ok(next.fonts.google.includes(preset.google), `${preset.name} is loaded`);
      // The dials do not see a font: it combines with every one of them.
      assert.deepEqual(levels(next, theme), ALL_HOME, `${preset.name} over ${name}`);
    }
  }
});

test('the line under the dials says what a step did', () => {
  const round = dialById('round');
  assert.match(dialHint(round, 4, 1), /^Round 4: radius\(n\) gives what radius\(n\+2\) gave/);
  assert.match(dialHint(round, 0, -1), /^Round 0: square corners/);
  assert.match(dialHint(dialById('shadow'), 0, -1), /^Shadow 0: no shadows/);
  assert.match(dialHint(dialById('border'), 0, -1), /^Border 0: no borders/);
  assert.match(dialHint(dialById('border'), 3, 1), /^Border 3: border\(n\) gives what border\(n\+1\) gave/);
  assert.match(dialHint(dialById('space'), 3, 1), /^Space 3: every density is 1\.15× what the theme you started from gives/);
  assert.match(dialHint(dialById('text'), 1, -1), /^Text 1: every font size is 0\.925× /);
  assert.match(dialHint(dialById('space'), null, 1), /^Roomier: every density on the page × 1\.15, your own edits included\.$/);
  assert.match(dialHint(dialById('text'), null, -1), /^Smaller: every font size on the page × 0\.93/);
  assert.match(dialHint(round, HOME, 1), /^Round 2: the values of the theme you started from\.$/);
  assert.match(dialHint(round, null, 1), /^Rounder: every radius\(n\) now gives what radius\(n\+1\) gave on the page/);
  assert.match(dialHint(round, null, -1), /^Sharper: .*radius\(n−1\)/);
});

test('the two brands replace each other, and taking one off gives back the starting theme', () => {
  assert.deepEqual(LOOKS.map((look) => look.kind), ['brand', 'brand']);
  assert.equal(new Set(LOOKS.map((look) => look.id)).size, LOOKS.length);
  const [first, second] = LOOKS.map((look) => look.id);
  const one = press(themes.default, first);
  assert.deepEqual(press(one, first), one, `${first} twice`);
  assert.deepEqual(on(press(one, second)), [second], `${second} replaces ${first}`);
  assert.deepEqual(press(one, second), press(themes.default, second), `${second} after ${first} is ${second} alone`);
  for (const look of LOOKS) {
    for (const [name, theme] of Object.entries(themes)) {
      const pressed = press(theme, look.id, theme);
      assert.deepEqual(on(pressed, theme), [look.id], `${look.id} on over ${name}`);
      const checked = checkPatch(pressed, lookOffPatch(look, theme));
      assert.ok(checked.ok, `${look.id} off over ${name}: ${checked.message}`);
      assert.deepEqual(release(pressed, look.id, theme), theme, `${look.id} off over ${name} is ${name} again`);
    }
  }
});
