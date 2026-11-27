// The Live theme handler's quick looks (src/lib/quick-looks.js): every look, over every named
// theme, is a value change applyTheme takes live, and adds no contrast failure.
const test = require('node:test');
const assert = require('node:assert/strict');
const { deepMergeTheme, resolveTheme, checkThemeContrast } = require('uxdsl/theme');
const exceptions = require('uxdsl/theme/base.contrast-exceptions.json');
const { themes } = require('../themes');
const { LOOKS, lookById } = require('../src/lib/quick-looks.js');
const { checkPatch } = require('../src/lib/theme-patch.js');

const failures = (theme) => checkThemeContrast(resolveTheme(theme), { exceptions }).failures.map((pair) => JSON.stringify(pair)).sort();

test('every look applies live over every named theme', () => {
  for (const [name, theme] of Object.entries(themes)) {
    for (const look of LOOKS) {
      const checked = checkPatch(theme, look.patch(theme));
      assert.ok(checked.ok, `${look.id} over ${name}: ${checked.message}`);
    }
  }
});

test('no look adds a contrast failure', () => {
  for (const [name, theme] of Object.entries(themes)) {
    const before = new Set(failures(theme));
    for (const look of LOOKS) {
      const added = failures(deepMergeTheme(theme, look.patch(theme))).filter((pair) => !before.has(pair));
      assert.deepEqual(added, [], `${look.id} over ${name}`);
    }
  }
});

test('looks compose, and density looks shift by one step', () => {
  const base = themes.default;
  const compact = deepMergeTheme(base, lookById('compact').patch(base));
  assert.equal(compact.densities['4'], base.densities['3']);
  assert.equal(compact.densities['1'], base.densities['1'], 'density(1) stays: there is no step below it but 0');
  const roomy = deepMergeTheme(base, lookById('roomy').patch(base));
  assert.equal(roomy.densities['4'], base.densities['5']);
  assert.equal(roomy.densities['15'], base.densities['15']);
  const both = deepMergeTheme(deepMergeTheme(base, lookById('rounder').patch(base)), lookById('ocean').patch(base));
  assert.equal(both.palette.primary.main, 'color(blue.700)');
  assert.equal(both.radii['2'], 'xs(space(4)) lg(space(5))');
  assert.equal(new Set(LOOKS.map((look) => look.id)).size, LOOKS.length);
});
