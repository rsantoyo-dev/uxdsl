const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildVarName, buildNamespacedVarName, NameRegistry } = require('../dist/naming');
const { compilePresetRules } = require('../dist/preset-engine');
const { generateFoundationCss } = require('../dist/foundations');
const { compileTypographyRules } = require('../dist/typography');

test('MIG-08: buildVarName/buildNamespacedVarName reproduce the exact existing public shapes', () => {
  assert.equal(buildVarName('space', '1'), '--uxdsl__space__1');
  assert.equal(buildVarName('density', '1'), '--uxdsl__density__1');
  assert.equal(buildVarName('surface', 'flat-padding'), '--uxdsl__surface__flat-padding');
  assert.equal(buildNamespacedVarName('palette', 'primary-main'), '--uxdsl__palette__primary-main');
  assert.equal(buildNamespacedVarName('color', 'gray-300'), '--uxdsl__color__gray-300');
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
  // The `--uxdsl__<family>__<key>` shape's `__` separator already
  // disambiguates a plain hyphen-joined family/key split — family "x" key
  // "a-b" and family "x-a" key "b" now produce distinct names
  // (`--uxdsl__x__a-b` vs `--uxdsl__x-a__b`), not a collision. What's still
  // reachable is a key or family containing a literal "__" itself (allowed
  // by preset token keys' `/^[\w-]+$/` validation, which permits
  // underscores) landing exactly on that separator: family "x" key
  // "y__z" and family "x__y" key "z" both produce `--uxdsl__x__y__z`. This
  // is the shared choke point for edges/shadows/surfaces/buttons/inputs,
  // so a fix here covers all of them at once.
  assert.throws(
    () => compilePresetRules({ x: { 'y__z': '1px' }, 'x__y': { z: '2px' } }, { xs: 0 }),
    /UXD_PRESET_NAME_COLLISION: "x__y\.z" and "x\.y__z" both produce --uxdsl__x__y__z\./
  );
  // A legitimate, non-colliding compile still works.
  const rules = compilePresetRules({ surface: { padding: '4px' } }, { xs: 0 });
  assert.equal(rules[0].values['--uxdsl__surface__padding'], '4px');
});

test('MIG-08: generateFoundationCss rejects a palette identifier colliding with a structured one', () => {
  assert.throws(
    () => generateFoundationCss({ palette: { 'primary-main': '#111', primary: { main: '#222' } } }),
    /UXD_FOUNDATION_NAME_COLLISION: "palette\.primary\.main" and "palette\.primary-main" both produce --uxdsl__palette__primary-main\./
  );
  assert.throws(
    () => generateFoundationCss({ colors: { 'gray-300': '#111', gray: { 300: '#222' } } }),
    /UXD_FOUNDATION_NAME_COLLISION: "color\.gray\.300" and "color\.gray-300" both produce --uxdsl__color__gray-300\./
  );
});

test('MIG-08: dark mode palette does not collide with the base palette (separate scope, expected override)', () => {
  const css = generateFoundationCss({ palette: { primary: { main: '#111' } }, modes: { dark: { palette: { primary: { main: '#222' } } } } });
  assert(css.includes('--uxdsl__palette__primary-main: #111'));
  assert(css.includes('@media (prefers-color-scheme: dark)'));
  assert(css.includes(':root[data-theme=\'dark\']'));
  assert.equal((css.match(/--uxdsl__palette__primary-main: #222/g) || []).length, 2);
});

test('MIG-08: centralizing name construction did not change existing output for a realistic theme', () => {
  const theme = {
    palette: { primary: { main: '#123', dark: '#111', contrast: '#fff' } },
    colors: { blue: { 500: '#123456' } },
    spacing: { 1: '4px', 2: '8px' },
  };
  const css = generateFoundationCss(theme);
  // MIG-B6-29: gray-* comes from theme/base.json's own colors.gray now
  // (DEFAULT_BORDER_COLORS derives from it), not a second, independently
  // hardcoded gray literal that used to live only in edges.ts.
  assert.equal(
    css,
    ":root { --uxdsl__palette__primary-main: #123; --uxdsl__palette__primary-dark: #111; --uxdsl__palette__primary-contrast: #fff; --uxdsl__color__blue-500: #123456; --uxdsl__color__gray-300: #CBD5E1; --uxdsl__color__gray-400: #94A3B8; --uxdsl__color__gray-500: #64748B; --uxdsl__color__gray-600: #475569; --uxdsl__space__1: 4px; --uxdsl__space__2: 8px; }"
  );
});

test('MIG-08: typography field names are centralized too (consistency; no realistic collision surface with the current fixed suffix set)', () => {
  const rules = compileTypographyRules({ h1: { fontSize: '1rem', fontWeight: '700' } }, { xs: 0 });
  assert.equal(rules[0].values['--uxdsl__typography__h1-size'], '1rem');
  assert.equal(rules[0].values['--uxdsl__typography__h1-weight'], '700');
});
