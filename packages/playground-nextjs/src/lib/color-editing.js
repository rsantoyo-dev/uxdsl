// The Live theme handler's Colors editor: a shade of the color collection, and who follows it.
//
// `colors` is the theme's collection: standalone names (white, black) and families of
// shades (gray.500). A Palette role, a border, a shadow or a Button state that says
// color(gray.500) moves when colors.gray.500 changes; a role that says palette(x), where x
// follows the shade, moves too, in the mode where it does. This finds both.
//
// Plain JS so scripts/test-color-editing.cjs can test it with node:test.

const { paletteFor } = require('./palette-editing');

// color(key) and color(key, alpha); color-mix( and background-color( are other names.
const COLOR_ANY = /(?<![\w-])color\(\s*([a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)?)\s*(?:,[^()]*)?\)/gi;
const PALETTE_ANY = /(?<![\w-])palette\(\s*([a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)?)\s*(?:,[^()]*)?\)/gi;
// The collection itself, and the Palette (read per mode below), are not "other" consumers.
const SKIP = new Set(['colors', 'palette', 'modes', 'spacing', 'breakpoints', 'fonts', '$schema']);

const names = (value, pattern) => [...String(value).matchAll(pattern)].map((m) => m[1].toLowerCase());
const roleKey = (key) => (key.includes('.') ? key : `${key}.main`);

/** The value of a shade: `gray.500` or a standalone name, `white`. Undefined when the theme has none. */
function colorValue(colors, key) {
  const [family, shade] = String(key).split('.');
  const entry = colors && colors[family];
  if (shade === undefined) return typeof entry === 'string' ? entry : undefined;
  return entry && typeof entry === 'object' ? entry[shade] : undefined;
}

/** The theme patch that writes one shade. */
function colorPatch(key, value) {
  const [family, shade] = String(key).split('.');
  return { colors: { [family]: shade === undefined ? value : { [shade]: value } } };
}

/** The roles of one mode's palette that follow color(key): directly, or through palette(role). */
function paletteFollowers(palette, key) {
  const wanted = String(key).toLowerCase();
  const values = [];
  for (const [family, entry] of Object.entries(palette || {})) {
    if (entry && typeof entry === 'object') for (const [variant, value] of Object.entries(entry)) values.push([`${family}.${variant}`, value]);
  }
  const found = new Map();
  for (const [role, value] of values) if (typeof value === 'string' && names(value, COLOR_ANY).includes(wanted)) found.set(role, null);
  // A role that links to a follower follows too; repeat until nothing is added.
  let added = true;
  while (added) {
    added = false;
    for (const [role, value] of values) {
      if (found.has(role) || typeof value !== 'string') continue;
      const via = names(value, PALETTE_ANY).map(roleKey).find((target) => found.has(target));
      if (via) { found.set(role, via); added = true; }
    }
  }
  return [...found].map(([role, via]) => ({ role, via }));
}

/**
 * Everything that follows color(key):
 * { light: [{ role, via }], dark: [{ role, via }], other: { buttons: ['contained.states.hover.bg'], … } }.
 * `via` is null for a role that names the shade itself, or the role it links to.
 */
function colorConsumers(theme, key) {
  const wanted = String(key).toLowerCase();
  const other = {};
  const visit = (value, path) => {
    if (typeof value === 'string') {
      if (names(value, COLOR_ANY).includes(wanted)) (other[path[0]] = other[path[0]] || []).push(path.slice(1).join('.'));
      return;
    }
    if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) visit(v, [...path, k]);
  };
  for (const [family, value] of Object.entries(theme || {})) if (!SKIP.has(family)) visit(value, [family]);
  return {
    light: paletteFollowers(paletteFor(theme, 'light'), key),
    dark: paletteFollowers(paletteFor(theme, 'dark'), key),
    other,
  };
}

/** How many places follow a shade, roles counted once per mode. */
function followerCount(found) {
  return found.light.length + found.dark.length + Object.values(found.other).reduce((sum, list) => sum + list.length, 0);
}

module.exports = { colorValue, colorPatch, colorConsumers, followerCount };
