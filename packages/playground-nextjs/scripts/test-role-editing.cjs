// The Live theme handler's Surfaces and Buttons / Inputs tabs: fields, patches, and the
// check that tells a value change (live) from a change to what a role emits (rebuild).
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getSurfaceTokens, getButtonTokens, getInputTokens, BUTTON_PROPERTIES, BUTTON_STATES, INPUT_PROPERTIES } = require('uxdsl/engine');
const { baseTheme } = require('../themes');
const r = require('../src/lib/role-editing');
const { checkPatch } = require('../src/lib/theme-patch');

test('a value change to a Surface, a Button or an Input state applies', () => {
  assert.deepEqual(checkPatch(baseTheme, r.rolePatch('surfaces', 'outlined', 'bg', 'palette(primary.light)')), { ok: true });
  assert.deepEqual(checkPatch(baseTheme, r.rolePatch('buttons', 'contained', 'bg', 'tone(main)', { state: 'hover' })), { ok: true });
  assert.deepEqual(checkPatch(baseTheme, r.rolePatch('inputs', 'outlined', 'border', '2px solid tone(main)', { state: 'focus' })), { ok: true });
  // Overriding in a Button's base a field its Surface already gives emits the same declarations.
  assert.deepEqual(checkPatch(baseTheme, r.rolePatch('buttons', 'contained', 'padding', 'density(4)')), { ok: true });
});

test('a reference that does not exist is refused as invalid', () => {
  const result = checkPatch(baseTheme, r.rolePatch('surfaces', 'flat', 'bg', 'palette(nope.main)'));
  assert.equal(result.kind, 'invalid');
});

test('a new field or a new state is refused as structural, with the change named', () => {
  const field = checkPatch(baseTheme, r.rolePatch('buttons', 'contained', 'font-weight', '700'));
  assert.equal(field.kind, 'structure');
  assert.match(field.message, /font-weight/);
  const state = checkPatch(baseTheme, r.rolePatch('buttons', 'contained', 'transform', 'scale(0.98)', { state: 'active' }));
  assert.equal(state.kind, 'structure');
  assert.match(state.message, /active/);
});

test('a Button’s base fields come from its Surface unless it sets its own', () => {
  const buttons = getButtonTokens(baseTheme);
  const surfaces = getSurfaceTokens(baseTheme);
  const fields = r.baseFields(buttons.contained, surfaces.contained, BUTTON_PROPERTIES);
  assert.deepEqual(fields.map((f) => f.field), ['padding', 'radius', 'bg', 'color', 'border', 'shadow']);
  assert.ok(fields.every((f) => f.source === 'surface'));
  const inputs = getInputTokens(baseTheme);
  const underline = r.baseFields(inputs.underline, surfaces.flat, INPUT_PROPERTIES);
  assert.equal(underline.find((f) => f.field === 'border').source, 'role');
  assert.equal(underline.find((f) => f.field === 'underline').value, inputs.underline.base.underline);
});

test('states come in the engine order; surfaces list who builds on them; suggestions fit the field', () => {
  const order = Object.keys(BUTTON_STATES);
  const states = r.stateFields(getButtonTokens(baseTheme).contained, BUTTON_STATES).map((s) => s.state);
  assert.deepEqual(states, [...states].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  assert.ok(states.includes('hover') && states.includes('disabled'));
  assert.deepEqual(r.surfaceUsers(getButtonTokens(baseTheme), getInputTokens(baseTheme), 'flat'), ['buttons.flat', 'inputs.underline']);
  assert.ok(r.suggestions(baseTheme, 'padding')[0].values.includes('density(2)'));
  assert.ok(r.suggestions(baseTheme, 'bg', { controls: true })[0].values.includes('tone(main)'));
  assert.ok(!r.suggestions(baseTheme, 'bg').some((g) => g.values.includes('tone(main)')));
});
