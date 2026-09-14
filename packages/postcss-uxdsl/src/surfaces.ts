import valueParser from 'postcss-value-parser';
import { BreakpointMap, DEFAULT_BREAKPOINTS } from './language';
import { compilePresetRules, mergePresetTokens } from './preset-engine';
import { EdgeTheme, getEdgeTokens, RADIUS_KEYWORDS } from './edges';
import { ShadowTheme, getShadowTokens } from './shadows';

export const SURFACE_PROPERTIES = Object.freeze({ padding: 'padding', radius: 'border-radius', bg: 'background', color: 'color', border: 'border', shadow: 'box-shadow' });
export type SurfaceStyle = Partial<Record<keyof typeof SURFACE_PROPERTIES, string>>;
export interface SurfaceTheme extends EdgeTheme, ShadowTheme { palette?: Record<string, unknown>; surfaces?: Record<string, SurfaceStyle> }
export const DEFAULT_SURFACES: Record<string, SurfaceStyle> = Object.freeze({
  contained: Object.freeze({ padding: 'density(2)', radius: 'radius(2)', bg: 'palette(surface-main)', color: 'palette(surface-contrast)', border: '1px solid palette(surface-dark)', shadow: 'shadow(1)' }),
  outlined: Object.freeze({ padding: 'density(2)', radius: 'radius(2)', bg: 'transparent', color: 'palette(surface-contrast)', border: '1px solid palette(neutral-main)', shadow: 'none' }),
  flat: Object.freeze({ padding: 'density(2)', radius: 'radius(2)', bg: 'transparent', color: 'palette(surface-contrast)', border: 'none', shadow: 'none' }),
});

export function getSurfaceTokens(theme: SurfaceTheme = {}): Record<string, SurfaceStyle> {
  if (theme.surfaces !== undefined && (!theme.surfaces || typeof theme.surfaces !== 'object' || Array.isArray(theme.surfaces))) throw new Error('UXD_SURFACE_MAP: Expected an object.');
  const result: Record<string, SurfaceStyle> = { ...DEFAULT_SURFACES };
  for (const [role, style] of Object.entries(theme.surfaces || {})) {
    if (!/^[a-z][a-z0-9-]*$/.test(role) || !style || typeof style !== 'object' || Array.isArray(style)) throw new Error(`UXD_SURFACE_ROLE: Invalid role ${role}.`);
    for (const key of Object.keys(style)) if (!Object.prototype.hasOwnProperty.call(SURFACE_PROPERTIES, key)) throw new Error(`UXD_SURFACE_FIELD: Unknown ${role}.${key}.`);
    result[role] = mergePresetTokens(DEFAULT_SURFACES[role] || DEFAULT_SURFACES.contained, style, 'UXD_SURFACE');
  }
  return result;
}

export function surfaceValueToCss(value: string, theme: SurfaceTheme) {
  const parsed = valueParser(value);
  const edges = getEdgeTokens(theme), shadows = getShadowTokens(theme);
  parsed.walk(node => {
    if (node.type === 'function' && ['palette', 'color'].includes(node.value)) {
      const args = valueParser.stringify(node.nodes).split(',').map(arg => arg.trim());
      if (args.length > 1) {
        const key = args[0].replace(/^(['"])(.*)\1$/, '$2'), alpha = Number(args[1]);
        if (args.length !== 2 || !/^[\w.-]+$/.test(key) || !args[1] || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) throw new Error('UXD_SURFACE_COLOR: Expected a token and alpha between 0 and 1.');
        Object.assign(node, { type: 'word', value: `color-mix(in srgb, var(--ds__${node.value}__${key.replace(/\./g, '-')}) ${alpha * 100}%, transparent)` });
        return false;
      }
    }
    if (node.type !== 'function' || !['radius', 'rounded', 'border', 'shadow', 'elevation'].includes(node.value)) return;
    const kind = node.value === 'rounded' ? 'radius' : node.value === 'elevation' ? 'shadow' : node.value;
    // Match the existing border helper contract: a configured preset wins over optional arguments.
    const key = valueParser.stringify(node.nodes).split(',')[0].trim().replace(/^(['"])(.*)\1$/, '$2');
    const map = kind === 'radius' ? edges.radii : kind === 'border' ? edges.borders : shadows;
    const keyword = kind === 'radius' ? RADIUS_KEYWORDS[key] : undefined;
    if (!keyword && !Object.prototype.hasOwnProperty.call(map, key)) throw new Error(`UXD_SURFACE_REFERENCE: Unknown ${kind} ${key}.`);
    Object.assign(node, { type: 'word', value: keyword || `var(--${kind}-${key})` });
    return false;
  });
  return parsed.toString();
}

export function compileSurfaceRules(theme: SurfaceTheme = {}, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }) {
  const groups: Record<string, Record<string, string>> = {};
  for (const [role, style] of Object.entries(getSurfaceTokens(theme))) {
    groups[`surface-${role}`] = {};
    for (const [field, value] of Object.entries(style)) groups[`surface-${role}`][field] = surfaceValueToCss(value!, theme);
  }
  return compilePresetRules(groups, breakpoints, 'UXD_SURFACE');
}
export function generateSurfaceCss(theme: SurfaceTheme = {}, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }, selector = ':root') {
  return compileSurfaceRules(theme, breakpoints).map(rule => {
    const css = `${selector} { ${Object.entries(rule.values).map(([p, v]) => `${p}: ${v};`).join(' ')} }`;
    return rule.minWidth === null ? css : `@media (min-width: ${rule.minWidth}px) { ${css} }`;
  }).join('\n');
}

/** Composition used by PostCSS directives and live component previews. */
export function surfaceDeclarations(theme: SurfaceTheme, role = 'contained', tone = '', size = ''): Record<string, string> {
  if (!Object.prototype.hasOwnProperty.call(getSurfaceTokens(theme), role)) throw new Error(`UXD_SURFACE_REFERENCE: Undefined surface ${role}.`);
  if (tone && !/^[a-z][a-z0-9-]*$/.test(tone)) throw new Error('UXD_SURFACE_TONE: Invalid palette family.');
  const result: Record<string, string> = {};
  for (const [field, property] of Object.entries(SURFACE_PROPERTIES)) result[property] = `var(--surface-${role}-${field})`;
  if (tone) {
    if (role === 'outlined') {
      result.background = 'transparent'; result.color = `var(--ds__palette__${tone}-main)`; result.border = `1px solid var(--ds__palette__${tone}-main)`;
    } else if (role === 'flat') {
      result.background = 'transparent'; result.color = `var(--ds__palette__${tone}-main)`;
    } else {
      result.background = `var(--ds__palette__${tone}-main)`; result.color = `var(--ds__palette__${tone}-contrast)`;
    }
  }
  if (size) {
    if (!/^\d+$/.test(size) || !Object.prototype.hasOwnProperty.call(getEdgeTokens(theme).radii, size)) throw new Error(`UXD_SURFACE_SIZE: Undefined radius for size ${size}.`);
    result.padding = `var(--density-${size})`; result['border-radius'] = `var(--radius-${size})`;
  }
  return result;
}
export function inspectSurfaceTheme(theme: SurfaceTheme, viewport: number) {
  if (!Number.isFinite(viewport) || viewport < 0) throw new Error('UXD_SURFACE_VIEWPORT: Expected a non-negative width.');
  const values: Record<string, string> = {};
  for (const rule of compileSurfaceRules(theme)) if (rule.minWidth === null || rule.minWidth <= viewport) Object.assign(values, rule.values);
  return values;
}

/** Legacy tone-only syntax is accepted when the effective palette defines it. */
export function parseSurfaceArguments(theme: SurfaceTheme, input: string) {
  const parts = input.trim().replace(/^\((.*)\)$/, '$1').split(/[\s,]+/).filter(Boolean);
  const roles = getSurfaceTokens(theme);
  const role = parts.find(part => Object.prototype.hasOwnProperty.call(roles, part)) || 'contained';
  const tone = parts.find(part => !Object.prototype.hasOwnProperty.call(roles, part) && !/^\d+$/.test(part)) || '';
  if (parts.length && !parts.some(part => Object.prototype.hasOwnProperty.call(roles, part)) && tone && !Object.prototype.hasOwnProperty.call(theme.palette || {}, tone)) throw new Error(`UXD_SURFACE_REFERENCE: Undefined surface or palette family ${tone}.`);
  return { role, tone, size: parts.find(part => /^\d+$/.test(part)) || '' };
}
