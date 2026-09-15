const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const exported = require('../dist/index');
const plugin = exported.default || exported;

// references: { mode: 'off' } keeps these cases focused on MIG-05 (the
// radius()/shadow() override arguments) instead of the unrelated,
// separately-tracked gap where a minimal theme also needs a full 1-16
// spacing scale for the always-on defaults to validate strictly.
const theme = {
  breakpoints: { xs: 0, lg: 1024 },
  palette: { primary: { main: '#123', dark: '#111', contrast: '#fff' } },
  radii: { 9: 'xs(space(9)) lg(space(10))' },
};
const compile = (source, options = {}) => postcss([plugin({ theme, references: { mode: 'off' }, ...options })]).process(source, { from: undefined });
function declared(css, selector) {
  const result = {};
  postcss.parse(css).walkRules(selector, r => r.walkDecls(d => { result[d.prop] = d.value; }));
  return result;
}

test('MIG-05: size still sets padding and radius together (legacy behavior, unchanged)', async () => {
  const css = (await compile('.x { @ds-surface(contained 2); }')).css;
  const props = declared(css, '.x');
  assert.equal(props.padding, 'var(--uxdsl__density__2)');
  assert.equal(props['border-radius'], 'var(--uxdsl__radius__2)');
});

test('MIG-05: an explicit radius() override replaces only the radius that size set, padding stays from size', async () => {
  const css = (await compile('.x { @ds-surface(contained 2 radius(4)); }')).css;
  const props = declared(css, '.x');
  assert.equal(props.padding, 'var(--uxdsl__density__2)');
  assert.equal(props['border-radius'], 'var(--uxdsl__radius__4)');
});

test('MIG-05: radius()/shadow() overrides work independently of size, and of each other', async () => {
  const radiusOnly = declared((await compile('.x { @ds-surface(contained radius(9)); }')).css, '.x');
  assert.equal(radiusOnly['border-radius'], 'var(--uxdsl__radius__9)');
  assert.equal(radiusOnly.padding, 'var(--uxdsl__surface__contained-padding)'); // role default, no size applied

  const both = declared((await compile('.x { @ds-surface(contained 2 radius(4) shadow(1)); }')).css, '.x');
  assert.equal(both.padding, 'var(--uxdsl__density__2)');
  assert.equal(both['border-radius'], 'var(--uxdsl__radius__4)');
  assert.equal(both['box-shadow'], 'var(--uxdsl__shadow__1)');
});

test('MIG-05: a radius keyword (pill/full/circle) is accepted as an override, matching the standalone radius() function', async () => {
  const props = declared((await compile('.x { @ds-surface(contained radius(pill)); }')).css, '.x');
  assert.equal(props['border-radius'], '9999px');
});

test('MIG-05: repeated radius()/shadow() overrides are rejected as ambiguous', async () => {
  await assert.rejects(compile('.x { @ds-surface(contained radius(2) radius(4)); }'), /UXD_SURFACE_ARGUMENT: Repeated radius\(\) argument\./);
  await assert.rejects(compile('.x { @ds-surface(contained shadow(1) shadow(2)); }'), /UXD_SURFACE_ARGUMENT: Repeated shadow\(\) argument\./);
});

test('MIG-05: an undefined override key is rejected with the same diagnostic family as the standalone functions', async () => {
  await assert.rejects(compile('.x { @ds-surface(contained radius(99)); }'), /UXD_SURFACE_REFERENCE: Undefined radius 99\./);
  await assert.rejects(compile('.x { @ds-surface(contained shadow(99)); }'), /UXD_SURFACE_REFERENCE: Undefined shadow 99\./);
  await assert.rejects(compile('.x { color: radius(99); }'), /UXD_EDGE_REFERENCE/);
});

test('MIG-05: the override composes with tone, and with legacy tone-only invocation', async () => {
  const props = declared((await compile('.x { @ds-surface(contained primary 2 radius(4)); }')).css, '.x');
  assert.equal(props.background, 'var(--uxdsl__palette__primary-main)');
  assert.equal(props['border-radius'], 'var(--uxdsl__radius__4)');
});

test('MIG-05: an explicit override wins even when the role itself defines radius/shadow in its base fields', async () => {
  // Regression: control-engine.ts composed `refs('base', pack.base)` after
  // surfaceDeclarations(), so a role that declares its own `radius`/`shadow`
  // base field silently reintroduced the role's value over the argument
  // override.
  const withRoleDefaults = {
    ...theme,
    buttons: { custom: { base: { radius: 'var(--uxdsl__radius__2)', shadow: 'var(--uxdsl__shadow__1)' } } },
  };
  const props = declared((await compile('.x { @ds-button(custom 2 radius(4) shadow(0)); }', { theme: withRoleDefaults })).css, '.x');
  assert.equal(props['border-radius'], 'var(--uxdsl__radius__4)');
  assert.equal(props['box-shadow'], 'var(--uxdsl__shadow__0)');
});

test('MIG-05: button and input accept the same radius()/shadow() override arguments as surface', async () => {
  const button = declared((await compile('.x { @ds-button(contained 2 radius(4)); }')).css, '.x');
  assert.equal(button.padding, 'var(--uxdsl__density__2)');
  assert.equal(button['border-radius'], 'var(--uxdsl__radius__4)');

  const input = declared((await compile('.x { @ds-input(contained 2 shadow(1)); }')).css, '.x');
  assert.equal(input.padding, 'var(--uxdsl__density__2)');
  assert.equal(input['box-shadow'], 'var(--uxdsl__shadow__1)');
});

test('MIG-05: a later plain CSS declaration in the same rule still wins last, same as before', async () => {
  const css = (await compile('.x { @ds-surface(contained 2 radius(4)); border-radius: 6px; }')).css;
  const rule = /\.x\s*\{([^}]*)\}/.exec(css)[1];
  const radiusDeclarations = [...rule.matchAll(/border-radius:\s*([^;]+);/g)].map(m => m[1]);
  assert.deepEqual(radiusDeclarations, ['var(--uxdsl__radius__4)', '6px']);
});
