const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildVarName, buildNamespacedVarName, NameRegistry } = require('../dist/naming');
const { compilePresetRules } = require('../dist/preset-engine');
const { generateFoundationCss } = require('../dist/foundations');
const { compileTypographyRules } = require('../dist/typography');

test('MIG-08: buildVarName/buildNamespacedVarName reproduce the exact existing public shapes', () => {
  assert.equal(buildVarName('space', '1'), '--space-1');
  assert.equal(buildVarName('density', '1'), '--density-1');
  assert.equal(buildVarName('surface-flat', 'padding'), '--surface-flat-padding');
  assert.equal(buildNamespacedVarName('palette', 'primary-main'), '--ds__palette__primary-main');
  assert.equal(buildNamespacedVarName('color', 'gray-300'), '--ds__color__gray-300');
});

test('MIG-08: NameRegistry lets the same identifier reclaim its own name (once per breakpoint) without error', () => {
  const names = new NameRegistry('UXD_TEST');
  const first = names.claim('--x-y', 'x.y');
  const second = names.claim('--x-y', 'x.y');
  assert.equal(first, '--x-y');
  assert.equal(second, '--x-y');
});

test('MIG-08: NameRegistry throws when two different identifiers claim the same name', () => {
  const names = new NameRegistry('UXD_TEST');
  names.claim('--x-y', 'x.y');
  assert.throws(() => names.claim('--x-y', 'x-y.'), /UXD_TEST_NAME_COLLISION: "x-y\." and "x\.y" both produce --x-y\./);
});

test('MIG-08: compilePresetRules (shared by edges/shadows/surfaces/buttons/inputs) rejects a real cross-family collision', () => {
  // Two independently-plausible family/key pairs concatenating to the
  // same generated name — e.g. a surface role "contained-shadow" (field
  // "x") vs role "contained" field "shadow-x" would collide the same way;
  // this is the shared choke point for edges/shadows/surfaces/buttons/
  // inputs, so a fix here covers all of them at once.
  assert.throws(
    () => compilePresetRules({ x: { 'a-b': '1px' }, 'x-a': { b: '2px' } }, { xs: 0 }),
    /UXD_PRESET_NAME_COLLISION: "x-a\.b" and "x\.a-b" both produce --x-a-b\./
  );
  // A legitimate, non-colliding compile still works.
  const rules = compilePresetRules({ surface: { padding: '4px' } }, { xs: 0 });
  assert.equal(rules[0].values['--surface-padding'], '4px');
});

test('MIG-08: generateFoundationCss rejects a palette identifier colliding with a structured one', () => {
  assert.throws(
    () => generateFoundationCss({ palette: { 'primary-main': '#111', primary: { main: '#222' } } }),
    /UXD_FOUNDATION_NAME_COLLISION: "palette\.primary\.main" and "palette\.primary-main" both produce --ds__palette__primary-main\./
  );
  assert.throws(
    () => generateFoundationCss({ colors: { 'gray-300': '#111', gray: { 300: '#222' } } }),
    /UXD_FOUNDATION_NAME_COLLISION: "color\.gray\.300" and "color\.gray-300" both produce --ds__color__gray-300\./
  );
});

test('MIG-08: dark mode palette does not collide with the base palette (separate scope, expected override)', () => {
  const css = generateFoundationCss({ palette: { primary: { main: '#111' } }, modes: { dark: { palette: { primary: { main: '#222' } } } } });
  assert(css.includes('--ds__palette__primary-main: #111'));
  assert(css.includes('@media (prefers-color-scheme: dark)'));
  assert(css.includes(':root[data-theme=\'dark\']'));
  assert.equal((css.match(/--ds__palette__primary-main: #222/g) || []).length, 2);
});

test('MIG-08: centralizing name construction did not change existing output for a realistic theme', () => {
  const theme = {
    palette: { primary: { main: '#123', dark: '#111', contrast: '#fff' } },
    colors: { blue: { 500: '#123456' } },
    spacing: { 1: '4px', 2: '8px' },
  };
  const css = generateFoundationCss(theme);
  assert.equal(
    css,
    ":root { --ds__palette__primary-main: #123; --ds__palette__primary-dark: #111; --ds__palette__primary-contrast: #fff; --ds__color__blue-500: #123456; --ds__color__gray-300: #d1d5db; --ds__color__gray-400: #9ca3af; --ds__color__gray-500: #6b7280; --ds__color__gray-600: #4b5563; --space-1: 4px; --space-2: 8px; }"
  );
});

test('MIG-08: typography field names are centralized too (consistency; no realistic collision surface with the current fixed suffix set)', () => {
  const rules = compileTypographyRules({ h1: { fontSize: '1rem', fontWeight: '700' } }, { xs: 0 });
  assert.equal(rules[0].values['--h1-size'], '1rem');
  assert.equal(rules[0].values['--h1-weight'], '700');
});
