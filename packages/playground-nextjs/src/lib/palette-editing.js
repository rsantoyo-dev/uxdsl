// The Live theme handler's palette editor: what a Palette value is, which
// values a variant may take, and the patch that writes one.
//
// A Palette leaf is written in one of three ways, and the editor keeps them
// apart because they mean different things:
//
//   * `color(purple.700)`: a shade of the theme's color collection. Editing
//     `colors.purple.700` later moves every role that names it.
//   * `palette(secondary.main)`: another role. The variant follows that role,
//     in each mode.
//   * anything else: a literal CSS color, tracking nothing.
//
// Only these exact one-argument spellings are recognized as references. A
// value with an alpha (`color(purple.700, 0.5)`) is shown as a literal, which
// is what it is to the editor: it is kept exactly as written until replaced.
//
// Written as plain JS so `scripts/test-palette-editing.cjs` can test it with
// node:test, like `theme-scheduler.js`.

const COLOR_REF = /^color\(\s*([a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)?)\s*\)$/i;
const PALETTE_REF = /^palette\(\s*([a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)?)\s*\)$/i;

/** @returns {{ source: 'collection' | 'role' | 'free', key: string | null }} */
function classifyValue(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  const color = COLOR_REF.exec(text);
  if (color) return { source: 'collection', key: color[1].toLowerCase() };
  const role = PALETTE_REF.exec(text);
  if (role) {
    const key = role[1].toLowerCase();
    // `palette(primary)` is `palette(primary.main)`.
    return { source: 'role', key: key.includes('.') ? key : `${key}.main` };
  }
  return { source: 'free', key: null };
}

/** The color collection as rows: one per family, standalone names (white, black) together. */
function colorRows(colors) {
  const rows = [];
  const named = [];
  for (const [name, entry] of Object.entries(colors || {})) {
    if (typeof entry === 'string') named.push({ key: name, label: name });
    else if (entry && typeof entry === 'object') {
      rows.push({ family: name, swatches: Object.keys(entry).map((shade) => ({ key: `${name}.${shade}`, label: shade })) });
    }
  }
  if (named.length) rows.unshift({ family: 'named', swatches: named });
  return rows;
}

/** The palette of one mode: dark is `modes.dark.palette` merged key by key over the light palette. */
function paletteFor(theme, mode) {
  const light = (theme && theme.palette) || {};
  if (mode !== 'dark') return light;
  const dark = (theme && theme.modes && theme.modes.dark && theme.modes.dark.palette) || {};
  const merged = {};
  for (const family of new Set([...Object.keys(light), ...Object.keys(dark)])) {
    const a = light[family];
    const b = dark[family];
    merged[family] = a && typeof a === 'object' && b && typeof b === 'object' ? { ...a, ...b } : (b !== undefined ? b : a);
  }
  return merged;
}

/** Whether a dark variant is written in `modes.dark.palette`, or inherits the light value. */
function isInherited(theme, family, variant) {
  const dark = theme && theme.modes && theme.modes.dark && theme.modes.dark.palette;
  return !(dark && dark[family] && typeof dark[family] === 'object' && variant in dark[family]);
}

/** Every `family.variant` of a palette, grouped by family, in the theme's order. */
function roleGroups(palette) {
  return Object.entries(palette || {})
    .filter(([, entry]) => entry && typeof entry === 'object')
    .map(([family, entry]) => ({ family, keys: Object.keys(entry).map((variant) => `${family}.${variant}`) }));
}

/**
 * The roles grouped by what they are for, as the editor shows them. A family the
 * theme has and no group names (one a project added) goes under "Other".
 */
const ROLE_GROUPS = [
  { label: 'Brand', families: ['primary', 'secondary', 'tertiary'] },
  { label: 'Status', families: ['success', 'info', 'warning', 'error'] },
  { label: 'Canvas', families: ['surface', 'light', 'dark', 'neutral'] },
  { label: 'Text and lines', families: ['text', 'divider', 'action'] },
];

function groupRoles(groups) {
  const byFamily = new Map(groups.map((group) => [group.family, group]));
  const placed = new Set();
  const result = [];
  for (const { label, families } of ROLE_GROUPS) {
    const roles = families.filter((family) => byFamily.has(family)).map((family) => byFamily.get(family));
    roles.forEach((role) => placed.add(role.family));
    if (roles.length) result.push({ label, roles });
  }
  const other = groups.filter((group) => !placed.has(group.family));
  if (other.length) result.push({ label: 'Other', roles: other });
  return result;
}

/**
 * Whether writing `palette(target)` into `edited` would make a cycle: the
 * target, followed through its own `palette()` references, reaches `edited`.
 * The validator refuses a cycle anyway (UXD_REFERENCE_CYCLE); this lets the
 * editor disable those choices instead of offering them.
 */
function wouldCycle(palette, edited, target) {
  const seen = new Set();
  let key = target;
  while (key && !seen.has(key)) {
    if (key === edited) return true;
    seen.add(key);
    const [family, variant] = key.split('.');
    const value = palette && palette[family] && palette[family][variant];
    const next = classifyValue(value);
    key = next.source === 'role' ? next.key : null;
  }
  return false;
}

/** The theme patch that writes one variant: `palette`, or `modes.dark.palette` for dark. */
function patchFor(mode, family, variant, value) {
  const entry = { [family]: { [variant]: value } };
  return mode === 'dark' ? { modes: { dark: { palette: entry } } } : { palette: entry };
}

/** Where a variant is written, as a path a reader can find in the JSON. */
function pathFor(mode, family, variant) {
  return `${mode === 'dark' ? 'modes.dark.palette' : 'palette'}.${family}.${variant}`;
}

/** The compiled variable of a `color()` or `palette()` key. */
function colorVar(key) {
  return `var(--uxdsl__color__${key.replace('.', '-')})`;
}
function paletteVar(key) {
  return `var(--uxdsl__palette__${key.replace('.', '-')})`;
}

/** WCAG 2 contrast ratio of two sRGB colors given as [r, g, b] in 0–255. */
function contrastRatio(a, b) {
  const luminance = ([r, g, b]) => {
    const [R, G, B] = [r, g, b].map((channel) => {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `#rgb` or `#rrggbb`, normalized to `#rrggbb`; anything else is null. */
function toHex6(value) {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  if (/^#[0-9a-f]{3}$/.test(text)) return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`;
  return null;
}

/** What the native color picker shows when the variant's rendered color cannot be read. */
const PICKER_FALLBACK = '#000000';

module.exports = {
  PICKER_FALLBACK,
  classifyValue,
  colorRows,
  paletteFor,
  isInherited,
  roleGroups,
  groupRoles,
  wouldCycle,
  patchFor,
  pathFor,
  colorVar,
  paletteVar,
  contrastRatio,
  toHex6,
};
