// The Live theme handler's Density tab: what one Density token gives at each breakpoint,
// and the definition an editor writes back.
//
// Reading a definition is the library's job: responsiveEntries (what each breakpoint
// says) and resolveResponsiveValue (what applies there, persistence included) from
// uxdsl/language. This file only turns a resolved spacing value into pixels for the
// drawing, and builds the definition string from one value per breakpoint.
//
// Plain JS so scripts/test-density-editing.cjs can test it with node:test.

const SPACE_REF = /^space\(\s*([\w-]+)\s*\)$/i;

/** The spacing key a value names (`space(4)` → `4`), or null for anything else. */
function spaceKeyOf(value) {
  const match = SPACE_REF.exec(String(value || '').trim());
  return match ? match[1] : null;
}

/**
 * A CSS length in pixels, for drawing only: `0`, `Npx` and `Nrem` (at 16px a rem), a
 * `space(n)` through the theme's spacing. Anything else (calc(), var(), em) is null: the
 * editor shows it as written and draws no ring for it.
 */
function lengthPx(value, spacing, rootPx = 16) {
  const text = String(value || '').trim();
  const key = spaceKeyOf(text);
  if (key !== null) return spacing && spacing[key] !== undefined ? lengthPx(spacing[key], spacing, rootPx) : null;
  if (text === '0') return 0;
  const match = /^(-?\d*\.?\d+)(px|rem)$/i.exec(text);
  if (!match) return null;
  return match[2].toLowerCase() === 'rem' ? Number(match[1]) * rootPx : Number(match[1]);
}

/** One value per breakpoint (empty = keeps the previous one) as a Density definition. */
function buildDefinition(values, order) {
  const parts = order.filter((name) => values[name] && String(values[name]).trim()).map((name) => `${name}(${String(values[name]).trim()})`);
  return parts.join(' ');
}

/** The Density keys in numeric order. */
function densityKeys(tokens) {
  return Object.keys(tokens || {}).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
}

module.exports = { spaceKeyOf, lengthPx, buildDefinition, densityKeys };
