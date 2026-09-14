import { BreakpointMap, DEFAULT_BREAKPOINTS } from './language';
import { compilePresetRules, mergePresetTokens } from './preset-engine';

export const DEFAULT_SHADOWS: Record<string, string> = Object.freeze({
  0: 'none',
  1: '0 1px 2px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.1)',
  2: '0 1px 2px rgba(0, 0, 0, 0.05), 0 2px 6px rgba(0, 0, 0, 0.12)',
  3: '0 2px 4px rgba(0, 0, 0, 0.06), 0 4px 10px rgba(0, 0, 0, 0.14)',
  4: '0 4px 6px rgba(0, 0, 0, 0.08), 0 10px 15px rgba(0, 0, 0, 0.16)',
  5: '0 10px 15px rgba(0, 0, 0, 0.1), 0 20px 25px rgba(0, 0, 0, 0.2)',
});
export interface ShadowTheme { shadows?: Record<string, string>; breakpoints?: BreakpointMap }
export const getShadowTokens = (theme: ShadowTheme = {}) => mergePresetTokens(DEFAULT_SHADOWS, theme.shadows, 'UXD_SHADOW');
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
