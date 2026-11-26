// The Live theme handler's Typography tab: what a text role emits, and the patches that edit it.
//
// A role in `typography_details` emits one declaration per field it has, its own fields over
// `default`'s (MIG-B6-17). Each field compiles to its own variable
// (--uxdsl__typography__h1-font-size), so changing any field the role already emits, its own
// or one it takes from `default`, is a value: applyTheme applies it live. Adding a field the
// role does not emit changes what @ds-typo wrote into compiled CSS, which applyTheme refuses
// (UXD_THEME_STRUCTURE); this editor only offers the fields a role emits.
//
// Plain JS so scripts/test-typography-editing.cjs can test it with node:test.

const FIELD_ORDER = [
  'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
  'textTransform', 'textDecoration', 'fontStyle', 'marginBlockStart', 'marginBlockEnd',
];

/** The roles in the theme's order, `default` last. */
function roleOrder(details) {
  const roles = Object.keys(details || {}).filter((role) => role !== 'default');
  return details && details.default ? [...roles, 'default'] : roles;
}

/**
 * The fields a role emits, in a fixed order: [{ field, value, own }]. `own` is false for a
 * field the role takes from `default` (editing it writes the role's own value).
 */
function fieldsOf(details, role) {
  const own = (details && details[role]) || {};
  const fallback = role === 'default' ? {} : (details && details.default) || {};
  const fields = new Set([...Object.keys(fallback), ...Object.keys(own)]);
  return [...fields]
    .sort((a, b) => (FIELD_ORDER.indexOf(a) + 1 || 99) - (FIELD_ORDER.indexOf(b) + 1 || 99))
    .map((field) => ({ field, value: field in own ? own[field] : fallback[field], own: field in own }));
}

/** The theme patch that writes one field of one role. */
function fieldPatch(role, field, value) {
  return { typography_details: { [role]: { [field]: value } } };
}

/** `fontSize` → `font-size`. */
function cssName(field) {
  return field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** The variables a role's fontFamily can name: one per `fonts.families` entry. */
function familyOptions(fonts) {
  return Object.keys((fonts && fonts.families) || {}).map((name) => ({ name, value: `var(--uxdsl__font__${name})` }));
}

/** Fonts the editor offers for a family, from Google Fonts: the `fonts.google` entry and the stack written. */
const FONT_PRESETS = [
  { name: 'Inter', google: 'Inter:wght@400;500;600;700', stack: 'Inter, sans-serif' },
  { name: 'Roboto', google: 'Roboto:wght@400;500;700', stack: 'Roboto, sans-serif' },
  { name: 'Space Grotesk', google: 'Space Grotesk:wght@400;500;600;700', stack: '"Space Grotesk", sans-serif' },
  { name: 'Lora', google: 'Lora:wght@400;500;600;700', stack: 'Lora, serif' },
  { name: 'Playfair Display', google: 'Playfair Display:wght@400;600;700', stack: '"Playfair Display", serif' },
  { name: 'Merriweather', google: 'Merriweather:wght@400;700', stack: 'Merriweather, serif' },
  { name: 'JetBrains Mono', google: 'JetBrains Mono:wght@400;500;700', stack: '"JetBrains Mono", monospace' },
  { name: 'Fira Code', google: 'Fira Code:wght@400;500;700', stack: '"Fira Code", monospace' },
];

/** The family name of a `fonts.google` entry: `Space Grotesk:wght@400` → `Space Grotesk`. */
function googleName(entry) {
  return String(entry).split(':')[0].replace(/\+/g, ' ').trim();
}

/** Whether a font stack names a family, quoted or not. */
function stackNames(stack, name) {
  return String(stack).split(',').map((part) => part.trim().replace(/^["']|["']$/g, '').toLowerCase()).includes(name.toLowerCase());
}

/**
 * The patch that sets `fonts.families[target]` to a preset, with its Google Fonts entry.
 * `fonts.google` is an array, so the patch carries the whole list: the entries some family
 * still names after the change, and the preset's. A font nothing names any more is dropped,
 * so switching fonts does not pile up @imports.
 */
function fontPresetPatch(fonts, target, preset) {
  const families = { ...((fonts && fonts.families) || {}), [target]: preset.stack };
  const kept = ((fonts && fonts.google) || []).filter((entry) => {
    const name = googleName(entry);
    return name.toLowerCase() !== preset.name.toLowerCase() && Object.values(families).some((stack) => stackNames(stack, name));
  });
  return { fonts: { google: [...kept, preset.google], families: { [target]: preset.stack } } };
}

/** The preset a family's stack is, if any. */
function presetOf(stack) {
  return FONT_PRESETS.find((preset) => preset.stack === stack) || null;
}

module.exports = { FIELD_ORDER, FONT_PRESETS, roleOrder, fieldsOf, fieldPatch, cssName, familyOptions, googleName, fontPresetPatch, presetOf };
