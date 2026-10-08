import { DEFAULT_BORDER_COLORS } from './edges';
import { TokenContext, tokenValueToCss } from './language';
import { themeError } from './diagnostics';
import { buildVarName, buildNamespacedVarName, NameRegistry } from './naming';
import { CssBlock, serializeBlocks } from './css-blocks';

/** Emits `--uxdsl__<namespace>__<key>[-<subKey>]` for every entry of a flat-or-
 * nested token map, claiming each name in `names` so two different logical
 * identifiers (e.g. top-level palette key `"primary-main"` and structured
 * `primary.main`) that concatenate to the identical variable name raise
 * `UXD_FOUNDATION_NAME_COLLISION` instead of one silently overwriting the
 * other.
 *
 * Stability phase 1: every value goes through the one value grammar
 * (`tokenValueToCss`), so `palette.brand.main: 'color(gray.300)'` or
 * `palette.text.primary: 'palette(surface.contrast)'` compile to the same
 * `var(--uxdsl__…)` reference on both CSS paths — foundations used to be
 * emitted raw, and only the plugin's final pass over every declaration
 * resolved them at build time. */
function namespacedVars(namespace: string, map: Record<string, unknown>, names: NameRegistry, context: TokenContext): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [key, val] of Object.entries(map)) {
    if (typeof val === 'object' && val !== null) {
      for (const [subKey, subVal] of Object.entries(val as Record<string, unknown>)) {
        const identifier = `${namespace}.${key}.${subKey}`;
        out.push([names.claim(buildNamespacedVarName(namespace, `${key}-${subKey}`), identifier), tokenValueToCss(String(subVal), context)]);
      }
    } else {
      out.push([names.claim(buildNamespacedVarName(namespace, key), `${namespace}.${key}`), tokenValueToCss(String(val), context)]);
    }
  }
  return out;
}

/** Canonical JSON -> CSS mapping for foundational values and Palette modes:
 * the `:root` block, then — when the theme has a dark palette — the same
 * overrides under `prefers-color-scheme: dark` and under `[data-theme='dark']`. */
export function foundationBlocks(theme: Record<string, any>): CssBlock[] {
  const cssVars: Array<[string, string]> = [];
  const names = new NameRegistry('UXD_FOUNDATION');

  // Palette
  if (theme.palette) cssVars.push(...namespacedVars('palette', theme.palette, names, theme));

  // Color scales (for color(token) -> --uxdsl__color__token). DEFAULT_BORDERS
  // (edges.ts) depends on color(gray.*); merge that dependency in here —
  // under the theme's own gray shades when given — so border(1..5) resolves
  // out of the box. A theme that overrides every DEFAULT_BORDERS key no
  // longer references gray and this merge goes unused.
  const colors = { ...theme.colors, gray: { ...DEFAULT_BORDER_COLORS.gray, ...theme.colors?.gray } };
  cssVars.push(...namespacedVars('color', colors, names, theme));

  // Spacing. A key is the token key itself (`"1"` -> --uxdsl__space__1). The
  // former `space-` prefixed spelling of the same key is an error naming the
  // bare key, so one token never has two spellings.
  if (theme.spacing) {
    Object.entries(theme.spacing as Record<string, unknown>).forEach(([key, val]) => {
      if (key.startsWith('space-')) throw themeError('UXD_SPACING_KEY', `The "space-" prefix was removed from spacing keys; write "${key.slice('space-'.length)}" instead of "${key}"`, `spacing.${key}`);
      cssVars.push([names.claim(buildVarName('space', key), `spacing.${key}`), tokenValueToCss(String(val), theme)]);
    });
  }

  const blocks: CssBlock[] = [{ selector: ':root', declarations: cssVars }];
  // Dark Mode — a separate scope (its own selector), so its palette names
  // are tracked in their own registry rather than colliding with the base
  // palette's identical names, which is expected (that's the override).
  if (theme.modes && theme.modes.dark && theme.modes.dark.palette) {
    const darkVars = namespacedVars('palette', theme.modes.dark.palette, new NameRegistry('UXD_FOUNDATION'), theme);

    if (darkVars.length > 0) {
      blocks.push({ selector: ":root:not([data-theme='light'])", declarations: darkVars, condition: '@media (prefers-color-scheme: dark)' });
      blocks.push({ selector: ":root[data-theme='dark']", declarations: darkVars });
    }
  }

  return blocks;
}

/** The foundation blocks as CSS, one line. */
export function generateFoundationCss(theme: Record<string, any>): string {
  return serializeBlocks(foundationBlocks(theme), ' ');
}
