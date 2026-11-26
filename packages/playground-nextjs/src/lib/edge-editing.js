// The Live theme handler's Borders / Radii tab: a Border or Radius token, one value per
// breakpoint, and who in the theme follows it.
//
// Reading a definition per breakpoint is the library's job (responsiveEntries,
// resolveResponsiveValue from uxdsl/language); building one back is density-editing's
// buildDefinition. This file splits a Border value into its width, style and color so the
// editor can offer a control for each, and finds the theme values that name a token.
//
// Plain JS so scripts/test-edge-editing.cjs can test it with node:test.

const STYLES = ['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset'];
// The token families this tab edits, and the function that names a token of each.
const KINDS = {
  borders: { fn: 'border', label: 'Borders' },
  radii: { fn: 'radius', label: 'Radii' },
};
// The families themselves are not consumers; a Palette or a Spacing value never names one.
const SKIP = new Set(['borders', 'radii', 'colors', 'palette', 'modes', 'spacing', 'breakpoints', 'fonts', '$schema']);

/** The words of a value at the top level: `2px solid color(gray.300)` → three, the commas inside color() kept. */
function splitTop(value) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of String(value || '').trim()) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (/\s/.test(char) && depth === 0) {
      if (current) parts.push(current);
      current = '';
    } else current += char;
  }
  if (current) parts.push(current);
  return parts;
}

/**
 * A Border value as `{ width, style, color }`, in the order CSS writes them most often, or
 * null when it is something else (`none`, a value in another order, a var()). The editor
 * offers a control per part for the first, and shows the second as written.
 */
function parseBorder(value) {
  const parts = splitTop(value);
  if (parts.length !== 3 || !STYLES.includes(parts[1].toLowerCase())) return null;
  return { width: parts[0], style: parts[1].toLowerCase(), color: parts[2] };
}

/** Back to one value. */
function buildBorder({ width, style, color }) {
  return [width, style, color].map((part) => String(part || '').trim()).filter(Boolean).join(' ');
}

/** The keys of a token family in numeric order, named keys after. */
function edgeKeys(tokens) {
  return Object.keys(tokens || {}).sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    if (Number.isFinite(na)) return -1;
    if (Number.isFinite(nb)) return 1;
    return a.localeCompare(b);
  });
}

/** The theme patch that writes one token. */
function edgePatch(kind, key, value) {
  return { [kind]: { [key]: value } };
}

/**
 * The theme values that name `border(key)` or `radius(key)`: surfaces, buttons, inputs,
 * shadows… as dotted paths (`surfaces.contained.radius`). A stylesheet that says
 * `border: border(1)` follows too; it is not in the theme, so it is not listed here.
 */
function edgeConsumers(theme, kind, key) {
  const fn = KINDS[kind] ? KINDS[kind].fn : kind;
  const escaped = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?<![\\w-])${fn}\\(\\s*${escaped}\\s*\\)`, 'i');
  const found = [];
  const walk = (node, path) => {
    if (typeof node === 'string') {
      if (pattern.test(node)) found.push(path.join('.'));
      return;
    }
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      for (const [name, child] of Object.entries(node)) walk(child, [...path, name]);
    }
  };
  for (const [family, value] of Object.entries(theme || {})) if (!SKIP.has(family)) walk(value, [family]);
  return found;
}

/**
 * The colors a Border can name, as `<select>` groups: the Palette roles first (a border that
 * follows a role follows dark mode too), then the color collection.
 */
function borderColorOptions(theme) {
  const groups = [];
  const roles = [];
  for (const [family, entry] of Object.entries((theme && theme.palette) || {})) {
    if (entry && typeof entry === 'object') for (const variant of Object.keys(entry)) roles.push(`palette(${family}.${variant})`);
  }
  if (roles.length) groups.push({ label: 'Palette', values: roles });
  const named = [];
  for (const [family, entry] of Object.entries((theme && theme.colors) || {})) {
    if (typeof entry === 'string') named.push(`color(${family})`);
    else if (entry && typeof entry === 'object') groups.push({ label: `colors.${family}`, values: Object.keys(entry).map((shade) => `color(${family}.${shade})`) });
  }
  if (named.length) groups.splice(roles.length ? 1 : 0, 0, { label: 'colors', values: named });
  return groups;
}

module.exports = { STYLES, KINDS, splitTop, parseBorder, buildBorder, edgeKeys, edgePatch, edgeConsumers, borderColorOptions };
