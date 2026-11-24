// The Live theme handler's Spacing editor: who follows a step of the spacing scale.
//
// A Spacing token is one value at every width. Densities, radii, borders, typography
// and the roles name it with space(k), often inside a responsive expression, so editing
// spacing.4 moves every one of those, at the breakpoints where they name it. This finds
// them: responsiveEntries (uxdsl/language) splits a value by breakpoint, and each part is
// searched for space(k).
//
// Plain JS so scripts/test-spacing-editing.cjs can test it with node:test.

const SPACE_ANY = /\bspace\(\s*([\w-]+)\s*\)/gi;
// Families that cannot name space(): the scale itself, colors, breakpoints, fonts.
const SKIP = new Set(['spacing', 'colors', 'palette', 'modes', 'breakpoints', 'fonts', '$schema']);

/**
 * Every place in the theme that names space(key), grouped by family:
 * { densities: [{ path: '4', breakpoints: ['md'] }], typography_details: [...], ... }.
 * `responsiveEntries` is passed in (uxdsl/language) so this file stays free of a parser.
 */
function spacingConsumers(theme, key, breakpoints, responsiveEntries) {
  const found = {};
  const visit = (value, path) => {
    if (typeof value === 'string') {
      const byBreakpoint = responsiveEntries(value, breakpoints);
      const at = Object.entries(byBreakpoint)
        .filter(([, part]) => [...String(part).matchAll(SPACE_ANY)].some((m) => m[1].toLowerCase() === String(key).toLowerCase()))
        .map(([bp]) => bp);
      if (at.length) (found[path[0]] = found[path[0]] || []).push({ path: path.slice(1).join('.'), breakpoints: at });
      return;
    }
    if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) visit(v, [...path, k]);
  };
  for (const [family, value] of Object.entries(theme || {})) if (!SKIP.has(family)) visit(value, [family]);
  return found;
}

/** How many places a consumers map holds. */
function consumerCount(found) {
  return Object.values(found).reduce((sum, list) => sum + list.length, 0);
}

module.exports = { spacingConsumers, consumerCount };
