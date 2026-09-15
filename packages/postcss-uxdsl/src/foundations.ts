import { DEFAULT_BORDER_COLORS } from './edges';
import { normalizeSpacingDefinitions } from './language';
import { buildVarName, buildNamespacedVarName, NameRegistry } from './naming';

/** Emits `--uxdsl__<namespace>__<key>[-<subKey>]` for every entry of a flat-or-
 * nested token map, claiming each name in `names` so two different logical
 * identifiers (e.g. top-level palette key `"primary-main"` and structured
 * `primary.main`) that concatenate to the identical variable name raise
 * `UXD_FOUNDATION_NAME_COLLISION` instead of one silently overwriting the
 * other (MIG-08). */
function namespacedVars(namespace: string, map: Record<string, unknown>, names: NameRegistry): string[] {
  const out: string[] = [];
  for (const [key, val] of Object.entries(map)) {
    if (typeof val === 'object' && val !== null) {
      for (const [subKey, subVal] of Object.entries(val as Record<string, unknown>)) {
        const identifier = `${namespace}.${key}.${subKey}`;
        out.push(`${names.claim(buildNamespacedVarName(namespace, `${key}-${subKey}`), identifier)}: ${subVal}`);
      }
    } else {
      out.push(`${names.claim(buildNamespacedVarName(namespace, key), `${namespace}.${key}`)}: ${val}`);
    }
  }
  return out;
}

/** Canonical JSON -> CSS mapping for foundational values and Palette modes. */
export function generateFoundationCss(theme: Record<string, any>): string {
  const cssVars: string[] = [];
  const names = new NameRegistry('UXD_FOUNDATION');

  // Palette
  if (theme.palette) cssVars.push(...namespacedVars('palette', theme.palette, names));

  // Color scales (for color(token) -> --uxdsl__color__token). DEFAULT_BORDERS
  // (edges.ts) depends on color(gray.*); merge that dependency in here —
  // under the theme's own gray shades when given — so border(1..5) resolves
  // out of the box. A theme that overrides every DEFAULT_BORDERS key no
  // longer references gray and this merge goes unused.
  const colors = { ...theme.colors, gray: { ...DEFAULT_BORDER_COLORS.gray, ...theme.colors?.gray } };
  cssVars.push(...namespacedVars('color', colors, names));

  // Spacing. MIG-01: "space-1" and "1" both mean --uxdsl__space__1; normalize
  // before emission so neither form silently doubles the prefix or lets
  // one spelling win by accidental object key order.
  if (theme.spacing) {
    Object.entries(normalizeSpacingDefinitions(theme.spacing)).forEach(([key, val]) => {
      cssVars.push(`${names.claim(buildVarName('space', key), `spacing.${key}`)}: ${val}`);
    });
  }

  let cssContent = `:root { ${cssVars.join('; ')}; }`;
  // Dark Mode — a separate scope (its own selector), so its palette names
  // are tracked in their own registry rather than colliding with the base
  // palette's identical names, which is expected (that's the override).
  if (theme.modes && theme.modes.dark && theme.modes.dark.palette) {
    const darkVars = namespacedVars('palette', theme.modes.dark.palette, new NameRegistry('UXD_FOUNDATION'));

    if (darkVars.length > 0) {
      const darkCss = darkVars.join('; ');
      cssContent += ` @media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ${darkCss}; } }`;
      cssContent += ` :root[data-theme='dark'] { ${darkCss}; }`;
    }
  }

  return cssContent;
}
