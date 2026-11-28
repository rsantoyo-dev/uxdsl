// The Live theme handler's rows (src/lib/theme-part-facts.js): what each part says about the
// theme on the page, and how many of its values an edit changed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { deepMergeTheme, KNOWN_THEME_FAMILIES } = require('uxdsl/theme');
const { themes, baseTheme } = require('../themes');
const { themeDiff, themeFamilies, leafCount } = require('../src/lib/theme-download.js');
const { DIALS, HOME, TOP, dialPatch, LOOKS, lookPatch } = require('../src/lib/quick-looks.js');
const { PART_FAMILIES, partChanges, partFacts } = require('../src/lib/theme-part-facts.js');

const diffOf = (theme) => themeDiff(themeFamilies(baseTheme), themeFamilies(theme));
const partIds = [...fs.readFileSync(path.join(__dirname, '../src/lib/theme-parts.ts'), 'utf8').matchAll(/\{ id: '([a-z]+)'/g)].map((match) => match[1]);

test('the parts are the ones the handler lists, and no family belongs to two', () => {
  assert.deepEqual(Object.keys(PART_FAMILIES), partIds);
  const families = Object.values(PART_FAMILIES).flatMap((list) => list || []);
  assert.equal(new Set(families).size, families.length);
  for (const family of families) assert.ok(KNOWN_THEME_FAMILIES.has(family), family);
  // Every family the base theme defines is edited by one part.
  for (const family of Object.keys(themeFamilies(baseTheme))) assert.ok(families.includes(family), family);
});

test('a theme nobody edited has no change in any part', () => {
  assert.deepEqual(partChanges(diffOf(themes.default)), Object.fromEntries(partIds.map((id) => [id, 0])));
  assert.deepEqual(partChanges(undefined), Object.fromEntries(partIds.map((id) => [id, 0])));
});

test('an edit counts in its own part and in the whole', () => {
  const edited = deepMergeTheme(themes.default, {
    palette: { primary: { main: 'color(blue.500)' } },
    modes: { dark: { palette: { primary: { main: 'color(blue.200)' } } } },
    radii: { 2: 'xs(space(4))' },
    breakpoints: { md: 800 },
  });
  const changes = partChanges(diffOf(edited));
  assert.equal(changes.colors, 2);
  assert.equal(changes.edges, 1);
  assert.equal(changes.breakpoints, 1);
  assert.equal(changes.shadows, 0);
  assert.equal(changes.json, 4);
});

test('every quick look and every dial level shows in at least one part, and the parts add up to the whole', () => {
  const patches = LOOKS.map((look) => [look.id, lookPatch(look, themes.default)]);
  for (const dial of DIALS) {
    for (let level = 0; level <= TOP; level += 1) {
      if (level !== HOME) patches.push([`${dial.id} ${level}`, dialPatch(dial, themes.default, level)]);
    }
  }
  for (const [name, patch] of patches) {
    const diff = diffOf(deepMergeTheme(themes.default, patch));
    const { json, ...parts } = partChanges(diff);
    assert.ok(json > 0, name);
    assert.equal(Object.values(parts).reduce((sum, n) => sum + n, 0), json, name);
    assert.equal(json, leafCount(diff), name);
  }
  // A dial at the level of the starting theme changes nothing.
  for (const dial of DIALS) assert.equal(partChanges(diffOf(deepMergeTheme(themes.default, dialPatch(dial, themes.default, HOME)))).json, 0, dial.id);
});

test('the facts are read from the theme', () => {
  const facts = partFacts(themes.default);
  assert.deepEqual(Object.keys(facts), partIds);
  assert.deepEqual(facts.breakpoints, ['sm 480', 'md 768', 'lg 1024', 'xl 1280']);
  assert.deepEqual(facts.surfaces, ['contained', 'outlined', 'flat']);
  assert.equal(facts.typography[0], 'Inter');
  assert.ok(facts.colors.includes('light + dark'));
  for (const [part, list] of Object.entries(facts)) {
    assert.ok(list.length > 0, part);
    for (const fact of list) assert.equal(typeof fact, 'string', part);
  }
  const moved = partFacts(deepMergeTheme(themes.default, { breakpoints: { md: 800 }, fonts: { families: { ui: '"Space Grotesk", sans-serif' } } }));
  assert.ok(moved.breakpoints.includes('md 800'));
  assert.equal(moved.typography[0], 'Space Grotesk');
  // A theme with nothing in it still answers for every part.
  assert.deepEqual(Object.keys(partFacts(undefined)), partIds);
});
