import { SurfaceTheme, getSurfaceTokens, surfaceDeclarations, surfaceValueToCss } from './surfaces';
import { DEFAULT_BREAKPOINTS, BreakpointMap } from './language';
import { compilePresetRules, mergePresetTokens } from './preset-engine';

export interface ControlRole { surface?: string; base?: Record<string, string>; states?: Record<string, Record<string, string>> }
export interface ControlTheme extends SurfaceTheme { [key: string]: any }

/** Shared role inheritance, responsive compilation, tone composition and state emitter. */
export function createControlEngine(spec: {
  family: 'input' | 'button'; defaults: Record<string, ControlRole>;
  properties: Record<string,string>; states: Record<string,string[]>;
  nativeDefaults?: Record<string,string>;
}) {
  const { family, defaults, properties, states: statesMap, nativeDefaults = {} } = spec;
  const collection = `${family}s`;
  const errorPrefix = `UXD_${family.toUpperCase()}`;
  const fail = (message: string) => new Error(message.replace(/UXD_INPUT/g, errorPrefix));
function object(value: unknown): value is Record<string, any> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function fields(value: Record<string, string> = {}) {
  if (!object(value)) throw fail('UXD_INPUT_FIELDS: Expected an object.');
  for (const key of Object.keys(value)) if (!Object.hasOwnProperty.call(properties, key)) throw fail(`UXD_INPUT_FIELD: Unknown ${key}.`);
  return mergePresetTokens({}, value, errorPrefix);
}
function getTokens(theme: ControlTheme = {}): Record<string, Required<ControlRole>> {
  if (theme[collection] !== undefined && !object(theme[collection])) throw fail('UXD_INPUT_MAP: Expected an object.');
  const result: Record<string, Required<ControlRole>> = {};
  const surfaces = getSurfaceTokens(theme);
  for (const role of Array.from(new Set([...Object.keys(defaults), ...Object.keys(theme[collection] || {})]))) {
    const input = theme[collection]?.[role] || {};
    if (!/^[a-z][a-z0-9-]*$/.test(role) || !object(input) || (theme[collection] && role in theme[collection] && !theme[collection][role])) throw fail(`UXD_INPUT_ROLE: Invalid ${role}.`);
    for (const key of Object.keys(input)) if (!['surface', 'base', 'states'].includes(key)) throw fail(`UXD_INPUT_FIELD: Unknown ${role}.${key}.`);
    const fallback = (Object.hasOwnProperty.call(defaults, role) ? defaults[role] : defaults.contained);
    const surface = input.surface === undefined ? fallback.surface! : input.surface;
    if (typeof surface !== 'string' || !Object.hasOwnProperty.call(surfaces, surface)) throw fail(`UXD_INPUT_SURFACE: Unknown ${surface}.`);
    if (input.states !== undefined && !object(input.states)) throw fail('UXD_INPUT_STATES: Expected an object.');
    const states: Record<string, Record<string,string>> = {};
    for (const key of Array.from(new Set([...Object.keys(fallback.states!), ...Object.keys(input.states || {})]))) {
      if (!Object.hasOwnProperty.call(statesMap, key)) throw fail(`UXD_INPUT_STATE: Unknown ${key}.`);
      states[key] = { ...fallback.states?.[key], ...fields(input.states?.[key]) };
    }
    result[role] = { surface, base: { ...fallback.base, ...fields(input.base) }, states };
  }
  return result;
}
function compileRules(theme: ControlTheme = {}, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }) {
  const groups: Record<string, Record<string,string>> = {};
  for (const [role, pack] of Object.entries(getTokens(theme))) {
    for (const [state, style] of Object.entries({ base: pack.base, ...pack.states })) {
      groups[`${family}-${role}-${state}`] = Object.fromEntries(Object.entries(style).map(([key,value]) => [key, surfaceValueToCss(value, theme)]));
      for (const tone of Object.keys(theme.palette || {}).filter(key => /^[a-z][a-z0-9-]*$/.test(key))) {
        groups[`${family}-${role}-tone-${tone}-${state}`] = Object.fromEntries(Object.entries(style).map(([key,value]) => [key, surfaceValueToCss(value.replace(new RegExp(String.raw`var\(--${family}-tone-(main|dark|contrast), var\(--ds__palette__primary-\1\)\)`, 'g'), (_, variant) => `var(--ds__palette__${tone}-${variant})`), theme)]));
      }
    }
  }
  return compilePresetRules(groups, breakpoints, errorPrefix);
}
function generateCss(theme: ControlTheme = {}, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }, selector = ':root') {
  return compileRules(theme, breakpoints).map(rule => {
    const css = `${selector} { ${Object.entries(rule.values).map(([key,value]) => `${key}: ${value};`).join(' ')} }`;
    return rule.minWidth === null ? css : `@media (min-width: ${rule.minWidth}px) { ${css} }`;
  }).join('\n');
}
function declarations(theme: ControlTheme, role = 'contained', tone = '', size = '') {
  const pack = getTokens(theme)[role];
  if (!pack) throw fail(`UXD_INPUT_ROLE: Undefined ${role}.`);
  const refs = (state: string, style: Record<string,string>) => Object.fromEntries(Object.keys(style).map(key => [properties[key], tone ? `var(--${family}-${role}-tone-${tone}-${state}-${key}, var(--${family}-${role}-${state}-${key}))` : `var(--${family}-${role}-${state}-${key})`]));
  const base: Record<string,string> = { ...nativeDefaults, ...surfaceDeclarations(theme, pack.surface, tone, size), ...refs('base', pack.base) };
  if (tone) for (const variant of ['main','dark','contrast']) base[`--${family}-tone-${variant}`] = `var(--ds__palette__${tone}-${variant})`;
  return { base, states: Object.fromEntries(Object.entries(pack.states).map(([state, style]) => [state, refs(state, style)])) };
}
function parseArguments(theme: ControlTheme, input: string) {
  const parts = input.trim().replace(/^(['"])(.*)\1$/, '$2').replace(/^\((.*)\)$/, '$1').split(/[\s,]+/).filter(Boolean);
  const roles = getTokens(theme);
  const role = parts.find(part => Object.hasOwnProperty.call(roles, part)) || 'contained';
  const rest = parts.filter(part => part !== role);
  const tone = rest.find(part => !/^\d+$/.test(part)) || '';
  const size = rest.find(part => /^\d+$/.test(part)) || '';
  if (rest.length > Number(!!tone) + Number(!!size) || (tone && (!/^[a-z][a-z0-9-]*$/.test(tone) || (!parts.some(part => Object.hasOwnProperty.call(roles, part)) && !Object.hasOwnProperty.call(theme.palette || {}, tone))))) throw fail(`UXD_INPUT_ARGUMENT: Invalid ${input}; use a configured role, Palette family and numeric size.`);
  return { role, tone, size };
}
function inspectTheme(theme: ControlTheme, viewport: number) {
  if (!Number.isFinite(viewport) || viewport < 0) throw fail('UXD_INPUT_VIEWPORT: Expected a non-negative width.');
  const values: Record<string,string> = {};
  for (const rule of compileRules(theme)) if (rule.minWidth === null || rule.minWidth <= viewport) Object.assign(values, rule.values);
  return values;
}
function componentCss(theme: ControlTheme, selector: string, role = 'contained', tone = '', size = '') {
  const {base, states} = declarations(theme, role, tone, size);
  const emit = (sel: string, declarations: Record<string,string>) => `${sel} { ${Object.entries(declarations).map(([key,value]) => `${key}: ${value};`).join(' ')} }`;
  const selectors = selector.split(',').map(value => value.trim());
  const render = (targets: string[], declarations: Record<string,string>) => {
    const { placeholder, ...regular } = declarations;
    const result = [emit(targets.join(', '), regular)];
    if (placeholder) result.push(emit(targets.map(value => `${value}::placeholder`).join(', '), { color: placeholder }));
    return result;
  };
  return [...render(selectors, base), ...Object.entries(states).flatMap(([state, declarations]) => render(selectors.flatMap(sel => statesMap[state].map(pseudo => `${sel}${pseudo}`)), declarations))].join('\n');
}

return { getTokens, compileRules, generateCss, declarations, parseArguments, inspectTheme, componentCss };
}
