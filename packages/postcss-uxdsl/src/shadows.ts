import { BreakpointMap, DEFAULT_BREAKPOINTS } from './language';
import { compilePresetRules, mergePresetTokens } from './preset-engine';
import { BASE_THEME } from './base-theme';

// MIG-B6-29 (FEAT-008): derived from theme/base.json, not a second,
// independently-maintained literal.
export const DEFAULT_SHADOWS: Record<string, string> = BASE_THEME.shadows as Record<string, string>;
export interface ShadowTheme { shadows?: Record<string, string>; breakpoints?: BreakpointMap }
// MIG-B6-13 (FEAT-008) code-review follow-up: same `keyPathPrefix` fix as
// edges.ts's radii/borders — `{ shadows: { '1': '' } }` previously threw an
// unlocated Error.
export const getShadowTokens = (theme: ShadowTheme = {}) => mergePresetTokens(DEFAULT_SHADOWS, theme.shadows, 'UXD_SHADOW', 'shadows');
export function compileShadowRules(theme: ShadowTheme = {}, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }) {
  return compilePresetRules({ shadow: getShadowTokens(theme) }, breakpoints, 'UXD_SHADOW');
}
export function generateShadowCss(theme: ShadowTheme = {}, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }, selector = ':root') {
  return compileShadowRules(theme, breakpoints).map(rule => {
    const css = `${selector} { ${Object.entries(rule.values).map(([p, v]) => `${p}: ${v};`).join(' ')} }`;
    return rule.minWidth === null ? css : `@media (min-width: ${rule.minWidth}px) { ${css} }`;
  }).join('\n');
}
export function inspectShadowTheme(theme: ShadowTheme, viewport: number) {
  if (!Number.isFinite(viewport) || viewport < 0) throw new Error('UXD_SHADOW_VIEWPORT: Expected a non-negative width.');
  const values: Record<string, string> = {};
  for (const rule of compileShadowRules(theme)) if (rule.minWidth === null || rule.minWidth <= viewport) Object.assign(values, rule.values);
  return values;
}
