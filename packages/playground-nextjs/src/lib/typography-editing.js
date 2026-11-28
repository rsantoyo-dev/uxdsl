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

/** The kinds a font list is grouped by, in the order shown. */
const FONT_KINDS = [
  { id: 'sans', label: 'Sans serif', fallback: 'sans-serif' },
  { id: 'serif', label: 'Serif', fallback: 'serif' },
  { id: 'display', label: 'Display', fallback: 'sans-serif' },
  { id: 'hand', label: 'Handwriting', fallback: 'cursive' },
  { id: 'mono', label: 'Monospace', fallback: 'monospace' },
];

// name, kind and the weights Google Fonts serves for the family: asking for a weight it does
// not have fails the whole @import, so each list was checked against fonts.googleapis.com.
const FONT_CATALOG = [
  ['Inter', 'sans', '400;500;600;700'],
  ['Roboto', 'sans', '400;500;700'],
  ['Open Sans', 'sans', '400;500;600;700'],
  ['Lato', 'sans', '400;700'],
  ['Poppins', 'sans', '400;500;600;700'],
  ['Montserrat', 'sans', '400;500;600;700'],
  ['Nunito', 'sans', '400;500;600;700'],
  ['DM Sans', 'sans', '400;500;600;700'],
  ['Manrope', 'sans', '400;500;600;700'],
  ['Work Sans', 'sans', '400;500;600;700'],
  ['Plus Jakarta Sans', 'sans', '400;500;600;700'],
  ['Outfit', 'sans', '400;500;600;700'],
  ['Raleway', 'sans', '400;500;600;700'],
  ['Rubik', 'sans', '400;500;600;700'],
  ['Figtree', 'sans', '400;500;600;700'],
  ['Sora', 'sans', '400;500;600;700'],
  ['Source Sans 3', 'sans', '400;500;600;700'],
  ['IBM Plex Sans', 'sans', '400;500;600;700'],
  ['Space Grotesk', 'sans', '400;500;600;700'],
  ['Lora', 'serif', '400;500;600;700'],
  ['Playfair Display', 'serif', '400;600;700'],
  ['Merriweather', 'serif', '400;700'],
  ['Source Serif 4', 'serif', '400;500;600;700'],
  ['Libre Baskerville', 'serif', '400;700'],
  ['EB Garamond', 'serif', '400;500;600;700'],
  ['Crimson Pro', 'serif', '400;500;600;700'],
  ['Bitter', 'serif', '400;500;600;700'],
  ['Fraunces', 'serif', '400;500;600;700'],
  ['DM Serif Display', 'display', '400'],
  ['Oswald', 'display', '400;500;600;700'],
  ['Bebas Neue', 'display', '400'],
  ['Caveat', 'hand', '400;500;600;700'],
  ['JetBrains Mono', 'mono', '400;500;700'],
  ['Fira Code', 'mono', '400;500;700'],
  ['IBM Plex Mono', 'mono', '400;500;600;700'],
  ['Source Code Pro', 'mono', '400;500;600;700'],
  ['Space Mono', 'mono', '400;700'],
];

/** A family name as a font stack writes it: quoted unless it is one plain word. */
const stackName = (name) => (/^[A-Za-z][A-Za-z-]*$/.test(name) ? name : `"${name}"`);

/**
 * Fonts the editors offer for a family, from Google Fonts: the `fonts.google` entry, the
 * stack written and the kind the lists group them by.
 */
const FONT_PRESETS = FONT_CATALOG.map(([name, kind, weights]) => ({
  name,
  kind,
  google: `${name}:wght@${weights}`,
  stack: `${stackName(name)}, ${FONT_KINDS.find((entry) => entry.id === kind).fallback}`,
}));

/** The presets by kind, for a list with one group per kind: `[{ label, presets }]`. */
const FONT_GROUPS = FONT_KINDS.map(({ id, label }) => ({ label, presets: FONT_PRESETS.filter((preset) => preset.kind === id) }));

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

module.exports = { FIELD_ORDER, FONT_KINDS, FONT_PRESETS, FONT_GROUPS, roleOrder, fieldsOf, fieldPatch, cssName, familyOptions, googleName, fontPresetPatch, presetOf };
