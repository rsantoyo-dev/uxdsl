// The Live theme handler's download: the theme on the page as a `uxdsl.theme.json` a
// project can use as it is.
//
// A project's theme file is an override: the compiler merges it over the packaged base
// theme (`uxdsl/theme/base.json`), a family it does not mention keeps the base's values,
// and a family it mentions partly keeps the base's other keys. So the file written here
// holds only what differs from that base, leaf by leaf: what the editors changed, plus what
// this site's own themes add (its color collection, a named theme's palette). Merging it
// over the base gives back the theme on the page; the tests check that round trip.
//
// The page's breakpoints go in it too, the previewed ones included: a running page cannot
// move a breakpoint (applyTheme refuses it), but a theme file can, at the next build.
//
// Plain JS so `scripts/test-theme-download.cjs` can test it with node:test.

const { KNOWN_THEME_FAMILIES } = require('uxdsl/theme');
const packagedBase = require('uxdsl/theme/base.json');

const FILE_NAME = 'uxdsl.theme.json';
// Relative to the file, which sits next to the build config at the project root.
const SCHEMA = './node_modules/uxdsl/schema/theme.schema.json';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The leaves of `theme` that differ from `base`, nested as in the theme. */
function themeDiff(base, theme) {
  const out = {};
  for (const [key, value] of Object.entries(theme || {})) {
    const was = isObject(base) ? base[key] : undefined;
    if (isObject(value) && isObject(was)) {
      const inner = themeDiff(was, value);
      if (Object.keys(inner).length > 0) out[key] = inner;
    } else if (JSON.stringify(value) !== JSON.stringify(was)) {
      out[key] = value;
    }
  }
  return out;
}

/** Only the theme's families: page state kept beside them (a background image) is not theme. */
function themeFamilies(theme) {
  return Object.fromEntries(Object.entries(theme || {}).filter(([family]) => KNOWN_THEME_FAMILIES.has(family)));
}

/**
 * The theme file for `theme`: `$schema` first, then what differs from the packaged base
 * (`full: true` writes every family instead, for a project that wants the whole theme in
 * view).
 */
function themeFile(theme, { full = false, base = packagedBase } = {}) {
  const families = themeFamilies(theme);
  return { $schema: SCHEMA, ...(full ? families : themeDiff(base, families)) };
}

/** The file's text: two-space JSON with a final newline, as an editor would save it. */
function themeFileText(theme, options) {
  return `${JSON.stringify(themeFile(theme, options), null, 2)}\n`;
}

/** How many leaves (string or number values) the file sets, `$schema` aside. */
function leafCount(file) {
  let count = 0;
  const walk = (value) => {
    if (isObject(value)) Object.values(value).forEach(walk);
    else count += 1;
  };
  for (const [key, value] of Object.entries(file || {})) if (key !== '$schema') walk(value);
  return count;
}

module.exports = { FILE_NAME, SCHEMA, themeDiff, themeFamilies, themeFile, themeFileText, leafCount };
