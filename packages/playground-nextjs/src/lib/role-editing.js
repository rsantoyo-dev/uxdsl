// The Live theme handler's Surfaces and Buttons / Inputs tabs: the fields of a role, where
// each comes from, the patch that writes one, and the values worth offering for it.
//
// What a role *is* comes from the engines (getSurfaceTokens, getButtonTokens,
// getInputTokens, SURFACE_PROPERTIES…), passed in by the editor; this file only arranges it.
//
// Plain JS so scripts/test-role-editing.cjs can test it with node:test.

const { edgeKeys } = require('./edge-editing');

// What kind of value each field takes, for the suggestions offered next to its text field.
const FIELD_KIND = {
  padding: 'density',
  radius: 'radius',
  bg: 'color',
  color: 'color',
  caret: 'color',
  placeholder: 'color',
  border: 'border',
  underline: 'border',
  shadow: 'shadow',
  outline: 'outline',
  'outline-offset': 'offset',
  opacity: 'opacity',
  cursor: 'cursor',
  'font-weight': 'weight',
  transform: 'transform',
};

/** The values offered for one field, as `<select>` groups. `controls` adds tone(), valid in Buttons and Inputs only. */
function suggestions(theme, field, { controls = false } = {}) {
  const kind = FIELD_KIND[field];
  const keys = (family) => edgeKeys((theme && theme[family]) || {});
  const palette = [];
  for (const [family, entry] of Object.entries((theme && theme.palette) || {})) {
    if (entry && typeof entry === 'object') for (const variant of Object.keys(entry)) palette.push(`palette(${family}.${variant})`);
  }
  const tones = controls ? [{ label: 'Follows the tone', values: ['tone(main)', 'tone(dark)', 'tone(contrast)'] }] : [];
  switch (kind) {
    case 'density':
      return [{ label: 'Density', values: keys('densities').map((k) => `density(${k})`) }];
    case 'radius':
      return [{ label: 'Radius', values: [...keys('radii').map((k) => `radius(${k})`), 'radius(pill)', 'radius(circle)'] }];
    case 'color':
      return [...tones, { label: 'Palette', values: ['transparent', ...palette] }];
    case 'border':
      return [
        { label: 'Border', values: keys('borders').map((k) => `border(${k})`) },
        ...(controls ? [{ label: 'Follows the tone', values: ['1px solid tone(main)', '1px solid tone(dark)', '2px solid tone(main)'] }] : []),
        { label: 'A role’s color', values: ['1px solid palette(neutral.main)', '1px solid palette(surface.dark)', '1px solid palette(primary.main)', 'none'] },
      ];
    case 'shadow':
      return [{ label: 'Shadow', values: ['none', ...keys('shadows').map((k) => `shadow(${k})`)] }];
    case 'outline':
      return [{ label: 'Outline', values: [...(controls ? ['2px solid tone(main)', '3px solid tone(main)', '2px dashed tone(main)'] : []), '2px solid palette(primary.main)', 'none'] }];
    case 'offset':
      return [{ label: 'Offset', values: ['0', '1px', '2px', '3px', '4px'] }];
    case 'opacity':
      return [{ label: 'Opacity', values: ['0.4', '0.5', '0.6', '0.8', '1'] }];
    case 'cursor':
      return [{ label: 'Cursor', values: ['pointer', 'default', 'not-allowed', 'text', 'progress'] }];
    case 'weight':
      return [{ label: 'Weight', values: ['400', '500', '600', '700', '800'] }];
    case 'transform':
      return [{ label: 'Transform', values: ['none', 'translateY(-1px)', 'translateY(1px)', 'scale(0.98)', 'scale(1.02)'] }];
    default:
      return [];
  }
}

/** The patch that writes one field: of a Surface (`part` omitted), a control's base, or one of its states. */
function rolePatch(family, role, field, value, { state } = {}) {
  if (family === 'surfaces') return { surfaces: { [role]: { [field]: value } } };
  if (state) return { [family]: { [role]: { states: { [state]: { [field]: value } } } } };
  return { [family]: { [role]: { base: { [field]: value } } } };
}

/**
 * A control role's base fields: its own (`source: 'role'`) over the ones its Surface gives
 * (`source: 'surface'`), in the engine's field order, then fields only the role has (caret…).
 */
function baseFields(token, surfaceToken, properties) {
  const own = (token && token.base) || {};
  const fromSurface = surfaceToken || {};
  const fields = [];
  for (const field of Object.keys(properties)) {
    if (own[field] !== undefined) fields.push({ field, value: own[field], source: 'role' });
    else if (fromSurface[field] !== undefined) fields.push({ field, value: fromSurface[field], source: 'surface' });
  }
  return fields;
}

/** The states a control role emits, in the engine's order, each with its fields. */
function stateFields(token, states) {
  const own = (token && token.states) || {};
  return Object.keys(states)
    .filter((state) => own[state] && Object.keys(own[state]).length)
    .map((state) => ({ state, fields: Object.entries(own[state]).map(([field, value]) => ({ field, value })) }));
}

/** The control roles that compose a Surface role: `buttons.contained`, `inputs.underline`… */
function surfaceUsers(buttons, inputs, surface) {
  const users = [];
  for (const [family, tokens] of [['buttons', buttons], ['inputs', inputs]]) {
    for (const [role, token] of Object.entries(tokens || {})) if (token && token.surface === surface) users.push(`${family}.${role}`);
  }
  return users;
}

module.exports = { FIELD_KIND, suggestions, rolePatch, baseFields, stateFields, surfaceUsers };
