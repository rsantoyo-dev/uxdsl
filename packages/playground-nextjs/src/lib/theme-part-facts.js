// What the Live theme handler says about each part of the theme before it is opened
// (LiveThemeHandler.tsx): a few facts read from the theme on the page, and how many of its
// values differ from the theme the site ships with. Pure functions of a theme, so the rows
// follow every edit, every dial and every look. The ids are src/lib/theme-parts.ts's.
const { FILE_NAME, themeFamilies, leafCount } = require('./theme-download.js');

/** The theme families each part edits. `json` is the whole theme. */
const PART_FAMILIES = {
  colors: ['colors', 'palette', 'modes'],
  breakpoints: ['breakpoints'],
  spacing: ['spacing', 'densities'],
  typography: ['fonts', 'typography_details'],
  edges: ['borders', 'radii'],
  shadows: ['shadows'],
  surfaces: ['surfaces'],
  controls: ['buttons', 'inputs'],
  json: null,
};

const keys = (value) => (value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : []);
const count = (items, one, many) => `${items.length} ${items.length === 1 ? one : many}`;

/**
 * How many values of each part differ, from a `themeDiff` (src/lib/theme-download.js).
 * `json` counts them all.
 */
function partChanges(diff) {
  const changes = {};
  for (const [part, families] of Object.entries(PART_FAMILIES)) {
    changes[part] = families
      ? leafCount(Object.fromEntries(families.filter((family) => family in (diff || {})).map((family) => [family, diff[family]])))
      : leafCount(diff);
  }
  return changes;
}

/** A few short facts about each part, as the theme has it now. */
function partFacts(theme) {
  const t = theme || {};
  const breakpoints = Object.entries(t.breakpoints || {})
    .filter(([, width]) => Number(width) > 0)
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .map(([name, width]) => `${name} ${width}`);
  const font = String((t.fonts && t.fonts.families && t.fonts.families.ui) || '').split(',')[0].trim().replace(/^["']|["']$/g, '');
  const textRoles = keys(t.typography_details).filter((role) => role !== 'default');
  const surfaces = keys(t.surfaces);
  return {
    colors: [
      count(keys(t.palette), 'role', 'roles'),
      count(keys(t.colors), 'color', 'colors'),
      ...(keys(t.modes && t.modes.dark && t.modes.dark.palette).length > 0 ? ['light + dark'] : []),
    ],
    breakpoints,
    spacing: [count(keys(t.spacing), 'size', 'sizes'), count(keys(t.densities), 'density', 'densities')],
    typography: [...(font ? [font] : []), count(textRoles, 'text role', 'text roles')],
    edges: [count(keys(t.borders), 'border', 'borders'), count(keys(t.radii), 'radius', 'radii')],
    shadows: [count(keys(t.shadows), 'shadow', 'shadows')],
    surfaces: surfaces.length > 0 && surfaces.length <= 4 ? surfaces : [count(surfaces, 'role', 'roles')],
    controls: [count(keys(t.buttons), 'button role', 'button roles'), count(keys(t.inputs), 'input role', 'input roles')],
    json: [`${leafCount(themeFamilies(t))} values`, FILE_NAME],
  };
}

module.exports = { PART_FAMILIES, partChanges, partFacts };
