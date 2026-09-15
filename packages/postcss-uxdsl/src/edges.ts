import { compilePresetRules, mergePresetTokens, presetValueToCss } from './preset-engine';
import { BreakpointMap, DEFAULT_BREAKPOINTS } from './language';

export const DEFAULT_RADII: Record<string, string> = Object.freeze({
  0: '0',
  1: 'xs(space(1)) lg(space(2))', 2: 'xs(space(2)) lg(space(3))',
  3: 'xs(space(3)) lg(space(4))', 4: 'xs(space(4)) lg(space(6))', 5: 'xs(space(6)) lg(space(8))',
});
export const DEFAULT_BORDERS: Record<string, string> = Object.freeze({
  1: 'xs(1px solid color(gray.300))', 2: 'xs(space(1) solid color(gray.300))',
  3: 'xs(space(2) solid color(gray.400))', 4: 'xs(space(3) solid color(gray.500))', 5: 'xs(space(4) solid color(gray.600))',
});
/** Color dependency of DEFAULT_BORDERS. Emitted by the foundation generator
 * (merged under theme.colors.gray, user shades winning per-key) so
 * border(1..5) resolves out of the box; a theme that overrides every
 * DEFAULT_BORDERS key no longer references this and it goes unused. */
export const DEFAULT_BORDER_COLORS: Record<string, Record<string, string>> = Object.freeze({
  gray: Object.freeze({ 300: '#d1d5db', 400: '#9ca3af', 500: '#6b7280', 600: '#4b5563' }),
});
export const RADIUS_KEYWORDS: Record<string, string> = Object.freeze({ pill: '9999px', full: '9999px', circle: '50%' });
export interface EdgeTheme { borders?: Record<string, string>; radii?: Record<string, string>; breakpoints?: BreakpointMap }

export const edgeValueToCss = (input: string) => presetValueToCss(input, 'UXD_EDGE');

export function getEdgeTokens(theme: EdgeTheme = {}) {
  return {
    borders: mergePresetTokens(DEFAULT_BORDERS, theme.borders, 'UXD_EDGE'),
    radii: mergePresetTokens(DEFAULT_RADII, theme.radii, 'UXD_EDGE'),
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
