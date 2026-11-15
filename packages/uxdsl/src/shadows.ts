// Shadows: the `shadows` theme family behind `shadow(k)`, static or
// responsive. The plugin, generateThemeCss, generateShadowCss and
// inspectShadowTheme share this one engine.

import { BreakpointMap, DEFAULT_BREAKPOINTS, TokenContext } from './language';
import { compilePresetRules, mergePresetTokens } from './preset-engine';
import { BASE_THEME } from './base-theme';
import { responsiveBlocks, serializeBlocks } from './css-blocks';

// Derived from theme/base.json, not a second,
// independently-maintained literal.
export const DEFAULT_SHADOWS: Record<string, string> = BASE_THEME.shadows as Record<string, string>;
export interface ShadowTheme extends TokenContext { shadows?: Record<string, string>; breakpoints?: BreakpointMap }
// Located with `keyPathPrefix`, as edges.ts's radii/borders are:
// `{ shadows: { '1': '' } }` fails naming `shadows.1`.
export const getShadowTokens = (theme: ShadowTheme = {}) => mergePresetTokens(DEFAULT_SHADOWS, theme.shadows, 'UXD_SHADOW', 'shadows');
export function compileShadowRules(theme: ShadowTheme = {}, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }) {
  return compilePresetRules({ shadow: getShadowTokens(theme) }, breakpoints, 'UXD_SHADOW', theme);
}
export function generateShadowCss(theme: ShadowTheme = {}, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }, selector = ':root') {
  return serializeBlocks(responsiveBlocks(compileShadowRules(theme, breakpoints), selector));
}
export function inspectShadowTheme(theme: ShadowTheme, viewport: number) {
  if (!Number.isFinite(viewport) || viewport < 0) throw new Error('UXD_SHADOW_VIEWPORT: Expected a non-negative width.');
  const values: Record<string, string> = {};
  for (const rule of compileShadowRules(theme)) if (rule.minWidth === null || rule.minWidth <= viewport) Object.assign(values, rule.values);
  return values;
}
