import valueParser from 'postcss-value-parser';
import { BreakpointMap, DEFAULT_BREAKPOINTS, getDensityTokens, getToneFamilies, tokenValueToCss, REMOVED_RADIUS_FULL } from './language';
import { closestKey, formatKeyList } from './diagnostics';
import { DirectiveArguments, parseDirectiveTokens, directiveArgumentsInner, toneError } from './directives';
import { compilePresetRules, mergePresetTokens } from './preset-engine';
import { EdgeTheme, getEdgeTokens, RADIUS_KEYWORDS } from './edges';
import { ShadowTheme, getShadowTokens } from './shadows';
import { buildVarName, buildNamespacedVarName } from './naming';
import { themeError } from './diagnostics';
import { BASE_THEME } from './base-theme';
import { responsiveBlocks, serializeBlocks } from './css-blocks';

export const SURFACE_PROPERTIES = Object.freeze({ padding: 'padding', radius: 'border-radius', bg: 'background', color: 'color', border: 'border', shadow: 'box-shadow' });
export type SurfaceStyle = Partial<Record<keyof typeof SURFACE_PROPERTIES, string>>;
export interface SurfaceTheme extends EdgeTheme, ShadowTheme { densities?: Record<string,string>; palette?: Record<string, unknown>; surfaces?: Record<string, SurfaceStyle> }
// Derived from theme/base.json, not a second,
// independently-maintained literal.
export const DEFAULT_SURFACES: Record<string, SurfaceStyle> = BASE_THEME.surfaces as Record<string, SurfaceStyle>;

// Each throw below now carries
// the theme key path it actually failed at (`surfaces`, `surfaces.<role>`,
// `surfaces.<role>.<field>`) via `themeError`, matching typography.ts's
// existing pattern — previously `{ surfaces: { contained: { bogus: 'red' } } }`
// threw `UXD_SURFACE_FIELD: Unknown contained.bogus.` with no `.keyPath` at
// all, even though the message already spelled out which role/field.
export function getSurfaceTokens(theme: SurfaceTheme = {}): Record<string, SurfaceStyle> {
  if (theme.surfaces !== undefined && (!theme.surfaces || typeof theme.surfaces !== 'object' || Array.isArray(theme.surfaces))) throw themeError('UXD_SURFACE_MAP', 'Expected an object', 'surfaces');
  const result: Record<string, SurfaceStyle> = { ...DEFAULT_SURFACES };
  for (const [role, style] of Object.entries(theme.surfaces || {})) {
    if (!/^[a-z][a-z0-9-]*$/.test(role) || !style || typeof style !== 'object' || Array.isArray(style)) throw themeError('UXD_SURFACE_ROLE', `Invalid role ${role}`, `surfaces.${role}`);
    for (const key of Object.keys(style)) if (!Object.prototype.hasOwnProperty.call(SURFACE_PROPERTIES, key)) throw themeError('UXD_SURFACE_FIELD', `Unknown ${role}.${key}`, `surfaces.${role}.${key}`);
    result[role] = mergePresetTokens(DEFAULT_SURFACES[role] || DEFAULT_SURFACES.contained, style, 'UXD_SURFACE', `surfaces.${role}`);
  }
  return result;
}

/** Surface/Button/Input values: the one value grammar, after checking that
 * every Density/Radius/Border/Shadow reference exists in the effective theme
 * (the composition consumes them directly, so a dangling one is reported here
 * with the family's own code rather than later by the reference pass). */
export function surfaceValueToCss(value: string, theme: SurfaceTheme) {
  // The grammar first (argument count, key shape), then the references the
  // composition consumes directly.
  const css = tokenValueToCss(value, theme);
  const edges = getEdgeTokens(theme), shadows = getShadowTokens(theme);
  valueParser(value).walk(node => {
    if (node.type !== 'function') return;
    const name = node.value.toLowerCase();
    const key = valueParser.stringify(node.nodes).trim();
    if (name === 'density' && !Object.prototype.hasOwnProperty.call(getDensityTokens(theme), key)) throw new Error(`UXD_DENSITY_REFERENCE: Undefined density ${key}.`);
    if (!['radius', 'border', 'shadow'].includes(name)) return;
    const map = name === 'radius' ? edges.radii : name === 'border' ? edges.borders : shadows;
    const keyword = name === 'radius' ? RADIUS_KEYWORDS[key] : undefined;
    if (!keyword && !Object.prototype.hasOwnProperty.call(map, key)) throw new Error(name === 'radius' && key === 'full' ? REMOVED_RADIUS_FULL : `UXD_SURFACE_REFERENCE: Unknown ${name} ${key}.`);
  });
  return css;
}

export function compileSurfaceRules(theme: SurfaceTheme = {}, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }) {
  // One shared "surface" family, keyed `${role}-${field}` — so the
  // emitted name is `--uxdsl__surface__<role>-<field>` (e.g.
  // `--uxdsl__surface__flat-padding`), matching every other family's
  // `--uxdsl__<family>__<key>` shape instead of folding the role into the
  // family portion.
  const surface: Record<string, string> = {};
  for (const [role, style] of Object.entries(getSurfaceTokens(theme))) {
    for (const [field, value] of Object.entries(style)) surface[`${role}-${field}`] = surfaceValueToCss(value!, theme);
  }
  return compilePresetRules({ surface }, breakpoints, 'UXD_SURFACE', theme);
}
export function generateSurfaceCss(theme: SurfaceTheme = {}, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }, selector = ':root') {
  return serializeBlocks(responsiveBlocks(compileSurfaceRules(theme, breakpoints), selector));
}

/**
 * Composition used by PostCSS directives and live component previews.
 *
 * Precedence: role/tone defaults apply first; `size` then sets
 * padding and radius together (legacy behavior, unchanged); an explicit
 * `radiusOverride`/`shadowOverride` replaces only that one property,
 * independently of `size` and of each other. A later plain CSS declaration
 * in the same rule still wins last, same as any other generated property.
 */
export function surfaceDeclarations(theme: SurfaceTheme, role = 'contained', tone = '', size = '', radiusOverride = '', shadowOverride = ''): Record<string, string> {
  if (!Object.prototype.hasOwnProperty.call(getSurfaceTokens(theme), role)) throw new Error(`UXD_SURFACE_REFERENCE: Undefined surface ${role}.`);
  if (tone && !/^[a-z][a-z0-9-]*$/.test(tone)) throw new Error('UXD_SURFACE_TONE: Invalid palette family.');
  const result: Record<string, string> = {};
  for (const [field, property] of Object.entries(SURFACE_PROPERTIES)) result[property] = `var(${buildVarName('surface', `${role}-${field}`)})`;
  if (tone) {
    const toneMain = `var(${buildNamespacedVarName('palette', `${tone}-main`)})`;
    if (role === 'outlined') {
      result.background = 'transparent'; result.color = toneMain; result.border = `1px solid ${toneMain}`;
    } else if (role === 'flat') {
      result.background = 'transparent'; result.color = toneMain;
    } else {
      result.background = toneMain; result.color = `var(${buildNamespacedVarName('palette', `${tone}-contrast`)})`;
    }
  }
  if (size) {
    if (!/^\d+$/.test(size) || (!Object.prototype.hasOwnProperty.call(getEdgeTokens(theme).radii, size) || !Object.prototype.hasOwnProperty.call(getDensityTokens(theme), size))) throw new Error(`UXD_SURFACE_SIZE: Size ${size} requires both Density and Radius tokens.`);
    result.padding = `var(${buildVarName('density', size)})`; result['border-radius'] = `var(${buildVarName('radius', size)})`;
  }
  if (radiusOverride) {
    const radii = getEdgeTokens(theme).radii;
    const keyword = RADIUS_KEYWORDS[radiusOverride];
    if (!keyword && !Object.prototype.hasOwnProperty.call(radii, radiusOverride)) throw new Error(radiusOverride === 'full' ? REMOVED_RADIUS_FULL : `UXD_SURFACE_REFERENCE: Undefined radius ${radiusOverride}.`);
    result['border-radius'] = keyword || `var(${buildVarName('radius', radiusOverride)})`;
  }
  if (shadowOverride) {
    if (!Object.prototype.hasOwnProperty.call(getShadowTokens(theme), shadowOverride)) throw new Error(`UXD_SURFACE_REFERENCE: Undefined shadow ${shadowOverride}.`);
    result['box-shadow'] = `var(${buildVarName('shadow', shadowOverride)})`;
  }
  return result;
}
export function inspectSurfaceTheme(theme: SurfaceTheme, viewport: number) {
  if (!Number.isFinite(viewport) || viewport < 0) throw new Error('UXD_SURFACE_VIEWPORT: Expected a non-negative width.');
  const values: Record<string, string> = {};
  for (const rule of compileSurfaceRules(theme)) if (rule.minWidth === null || rule.minWidth <= viewport) Object.assign(values, rule.values);
  return values;
}

/** The role a directive names must exist; the error lists the roles that do and, when the
 * word is a tone, says the role comes first. Shared by the three directives. */
export function requireRole(directive: string, code: string, role: string, roles: string[], palette: Record<string, unknown> | undefined): void {
  if (roles.includes(role)) return;
  const tones = getToneFamilies(palette);
  if (tones.includes(role)) throw new Error(`${code}: "${role}" is a tone, not a role; the role comes first — write @${directive}(${roles[0]} ${role}). Roles: ${formatKeyList(roles)}.`);
  const suggestion = closestKey(role, roles);
  throw new Error(`${code}: Undefined ${directive.replace('ds-', '')} role "${role}"; roles: ${formatKeyList(roles)}.${suggestion ? ` Did you mean "${suggestion}"?` : ''}`);
}

/** `@ds-surface(role [tone] [size] [radius(k)] [shadow(k)])`: the grammar, then the role and tone against the theme. */
export function parseSurfaceArguments(theme: SurfaceTheme, input: string): DirectiveArguments {
  const args = parseDirectiveTokens('ds-surface', directiveArgumentsInner('ds-surface', input));
  requireRole('ds-surface', 'UXD_SURFACE_REFERENCE', args.role, Object.keys(getSurfaceTokens(theme)), theme.palette);
  if (args.tone) {
    const tones = getToneFamilies(theme.palette);
    if (!tones.includes(args.tone)) throw toneError('UXD_SURFACE_TONE', args.tone, tones);
  }
  return args;
}
