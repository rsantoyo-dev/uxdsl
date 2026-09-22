import { compilePresetRules, mergePresetTokens, presetValueToCss } from './preset-engine';
import { BreakpointMap, DEFAULT_BREAKPOINTS } from './language';
import { BASE_THEME } from './base-theme';

// MIG-B6-29 (FEAT-008): derived from theme/base.json, not a second,
// independently-maintained literal.
export const DEFAULT_RADII: Record<string, string> = BASE_THEME.radii as Record<string, string>;
export const DEFAULT_BORDERS: Record<string, string> = BASE_THEME.borders as Record<string, string>;
/** Color dependency of DEFAULT_BORDERS. Emitted by the foundation generator
 * (merged under theme.colors.gray, user shades winning per-key) so
 * border(1..5) resolves out of the box; a theme that overrides every
 * DEFAULT_BORDERS key no longer references this and it goes unused.
 * MIG-B6-29: this used to be a *second*, independently hardcoded `gray`
 * literal that quietly diverged from the playground's own base theme colors
 * (`#d1d5db` here vs. `#CBD5E1` there — different hues, not a casing typo).
 * Now derived from the same `theme/base.json` every other default comes
 * from, so there is exactly one `colors.gray` in the whole package. */
export const DEFAULT_BORDER_COLORS: Record<string, Record<string, string>> = Object.freeze({ gray: BASE_THEME.colors.gray });
export const RADIUS_KEYWORDS: Record<string, string> = Object.freeze({ pill: '9999px', full: '9999px', circle: '50%' });
export interface EdgeTheme { borders?: Record<string, string>; radii?: Record<string, string>; breakpoints?: BreakpointMap }

export const edgeValueToCss = (input: string) => presetValueToCss(input, 'UXD_EDGE');

export function getEdgeTokens(theme: EdgeTheme = {}) {
  return {
    borders: mergePresetTokens(DEFAULT_BORDERS, theme.borders, 'UXD_EDGE', 'borders'),
    radii: mergePresetTokens(DEFAULT_RADII, theme.radii, 'UXD_EDGE', 'radii'),
  };
}

export function compileEdgeRules(theme: EdgeTheme = {}, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }) {
  const tokens = getEdgeTokens(theme);
  return compilePresetRules({ border: tokens.borders, radius: tokens.radii }, breakpoints, 'UXD_EDGE');
}

export function generateEdgeCss(theme: EdgeTheme = {}, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }, selector = ':root'): string {
  return compileEdgeRules(theme, breakpoints).map(rule => {
    const css = `${selector} { ${Object.entries(rule.values).map(([p, v]) => `${p}: ${v};`).join(' ')} }`;
    return rule.minWidth === null ? css : `@media (min-width: ${rule.minWidth}px) { ${css} }`;
  }).join('\n');
}

export function inspectEdgeTheme(theme: EdgeTheme, viewport: number) {
  if (!Number.isFinite(viewport) || viewport < 0) throw new Error('UXD_EDGE_VIEWPORT: Expected a non-negative width.');
  const values: Record<string, string> = {};
  for (const rule of compileEdgeRules(theme)) if (rule.minWidth === null || rule.minWidth <= viewport) Object.assign(values, rule.values);
  return values;
}
