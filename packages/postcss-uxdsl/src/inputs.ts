import { SurfaceTheme, SURFACE_PROPERTIES, getSurfaceTokens, surfaceDeclarations, surfaceValueToCss } from './surfaces';
import { DEFAULT_BREAKPOINTS, BreakpointMap } from './language';
import { compilePresetRules, mergePresetTokens } from './preset-engine';

export const INPUT_PROPERTIES: Record<string, string> = { ...SURFACE_PROPERTIES, opacity: 'opacity', outline: 'outline', 'outline-offset': 'outline-offset', transform: 'transform', cursor: 'cursor', 'font-weight': 'font-weight', caret: 'caret-color', placeholder: 'placeholder', underline: 'border-bottom' };
export const INPUT_STATES: Record<string, string[]> = { hover: [':hover'], focus: [':focus'], focusvisible: [':focus-visible'], readonly: [':read-only'], invalid: [':invalid', '[aria-invalid="true"]'], disabled: [':disabled', '[aria-disabled="true"]'] };
export interface InputRole { surface?: string; base?: Record<string, string>; states?: Record<string, Record<string, string>> }
export interface InputTheme extends SurfaceTheme { inputs?: Record<string, InputRole> }
const main = 'var(--input-tone-main, var(--ds__palette__primary-main))';
export const DEFAULT_INPUTS: Record<string, InputRole> = {
  contained: { surface: 'contained', base: { caret: main, placeholder: 'palette(neutral.dark)' }, states: { focus: { border: `1px solid ${main}`, shadow: 'shadow(2)' }, invalid: { border: '1px solid palette(error.main)' }, disabled: { color: 'palette(neutral.dark)', opacity: '0.6' } } },
  outlined: { surface: 'outlined', base: { caret: main, placeholder: 'palette(neutral.dark)' }, states: { focus: { border: `1px solid ${main}` }, invalid: { border: '1px solid palette(error.main)' }, disabled: { opacity: '0.6' } } },
  underline: { surface: 'flat', base: { border: 'none', shadow: 'none', underline: '1px solid palette(neutral.dark)', caret: main, placeholder: 'palette(neutral.dark)' }, states: { focus: { underline: `1px solid ${main}` }, invalid: { underline: '1px solid palette(error.main)' }, disabled: { opacity: '0.6' } } },
};
for (const pack of Object.values(DEFAULT_INPUTS)) {
  Object.freeze(pack.base);
  for (const state of Object.values(pack.states!)) Object.freeze(state);
  Object.freeze(pack.states); Object.freeze(pack);
}
Object.freeze(DEFAULT_INPUTS);
function object(value: unknown): value is Record<string, any> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function fields(value: Record<string, string> = {}) {
  if (!object(value)) throw new Error('UXD_INPUT_FIELDS: Expected an object.');
  for (const key of Object.keys(value)) if (!Object.hasOwnProperty.call(INPUT_PROPERTIES, key)) throw new Error(`UXD_INPUT_FIELD: Unknown ${key}.`);
  return mergePresetTokens({}, value, 'UXD_INPUT');
}
export function getInputTokens(theme: InputTheme = {}): Record<string, Required<InputRole>> {
  if (theme.inputs !== undefined && !object(theme.inputs)) throw new Error('UXD_INPUT_MAP: Expected an object.');
  const result: Record<string, Required<InputRole>> = {};
  const surfaces = getSurfaceTokens(theme);
  for (const role of Array.from(new Set([...Object.keys(DEFAULT_INPUTS), ...Object.keys(theme.inputs || {})]))) {
    const input = theme.inputs?.[role] || {};
    if (!/^[a-z][a-z0-9-]*$/.test(role) || !object(input) || (theme.inputs && role in theme.inputs && !theme.inputs[role])) throw new Error(`UXD_INPUT_ROLE: Invalid ${role}.`);
    for (const key of Object.keys(input)) if (!['surface', 'base', 'states'].includes(key)) throw new Error(`UXD_INPUT_FIELD: Unknown ${role}.${key}.`);
    const fallback = (Object.hasOwnProperty.call(DEFAULT_INPUTS, role) ? DEFAULT_INPUTS[role] : DEFAULT_INPUTS.contained);
    const surface = input.surface === undefined ? fallback.surface! : input.surface;
    if (typeof surface !== 'string' || !Object.hasOwnProperty.call(surfaces, surface)) throw new Error(`UXD_INPUT_SURFACE: Unknown ${surface}.`);
    if (input.states !== undefined && !object(input.states)) throw new Error('UXD_INPUT_STATES: Expected an object.');
    const states: Record<string, Record<string,string>> = {};
    for (const key of Array.from(new Set([...Object.keys(fallback.states!), ...Object.keys(input.states || {})]))) {
      if (!Object.hasOwnProperty.call(INPUT_STATES, key)) throw new Error(`UXD_INPUT_STATE: Unknown ${key}.`);
      states[key] = { ...fallback.states?.[key], ...fields(input.states?.[key]) };
    }
    result[role] = { surface, base: { ...fallback.base, ...fields(input.base) }, states };
  }
  return result;
}
export function compileInputRules(theme: InputTheme = {}, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }) {
  const groups: Record<string, Record<string,string>> = {};
  for (const [role, pack] of Object.entries(getInputTokens(theme))) {
    for (const [state, style] of Object.entries({ base: pack.base, ...pack.states })) {
      groups[`input-${role}-${state}`] = Object.fromEntries(Object.entries(style).map(([key,value]) => [key, surfaceValueToCss(value, theme)]));
      for (const tone of Object.keys(theme.palette || {}).filter(key => /^[a-z][a-z0-9-]*$/.test(key))) {
        groups[`input-${role}-tone-${tone}-${state}`] = Object.fromEntries(Object.entries(style).map(([key,value]) => [key, surfaceValueToCss(value.replace(/var\(--input-tone-(main|dark|contrast), var\(--ds__palette__primary-\1\)\)/g, (_, variant) => `var(--ds__palette__${tone}-${variant})`), theme)]));
      }
    }
  }
  return compilePresetRules(groups, breakpoints, 'UXD_INPUT');
}
export function generateInputCss(theme: InputTheme = {}, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }, selector = ':root') {
  return compileInputRules(theme, breakpoints).map(rule => {
    const css = `${selector} { ${Object.entries(rule.values).map(([key,value]) => `${key}: ${value};`).join(' ')} }`;
    return rule.minWidth === null ? css : `@media (min-width: ${rule.minWidth}px) { ${css} }`;
  }).join('\n');
}
export function inputDeclarations(theme: InputTheme, role = 'contained', tone = '', size = '') {
  const pack = getInputTokens(theme)[role];
  if (!pack) throw new Error(`UXD_INPUT_ROLE: Undefined ${role}.`);
  const refs = (state: string, style: Record<string,string>) => Object.fromEntries(Object.keys(style).map(key => [INPUT_PROPERTIES[key], tone ? `var(--input-${role}-tone-${tone}-${state}-${key}, var(--input-${role}-${state}-${key}))` : `var(--input-${role}-${state}-${key})`]));
  const base: Record<string,string> = { 'box-sizing': 'border-box', font: 'inherit', width: '100%', ...surfaceDeclarations(theme, pack.surface, tone, size), ...refs('base', pack.base) };
  if (tone) for (const variant of ['main','dark','contrast']) base[`--input-tone-${variant}`] = `var(--ds__palette__${tone}-${variant})`;
  return { base, states: Object.fromEntries(Object.entries(pack.states).map(([state, style]) => [state, refs(state, style)])) };
}
export function parseInputArguments(theme: InputTheme, input: string) {
  const parts = input.trim().replace(/^(['"])(.*)\1$/, '$2').replace(/^\((.*)\)$/, '$1').split(/[\s,]+/).filter(Boolean);
  const roles = getInputTokens(theme);
  const role = parts.find(part => Object.hasOwnProperty.call(roles, part)) || 'contained';
  const rest = parts.filter(part => part !== role);
  const tone = rest.find(part => !/^\d+$/.test(part)) || '';
  const size = rest.find(part => /^\d+$/.test(part)) || '';
  if (rest.length > Number(!!tone) + Number(!!size) || (tone && (!/^[a-z][a-z0-9-]*$/.test(tone) || (!parts.some(part => Object.hasOwnProperty.call(roles, part)) && !Object.hasOwnProperty.call(theme.palette || {}, tone))))) throw new Error(`UXD_INPUT_ARGUMENT: Invalid ${input}; use a configured role, Palette family and numeric size.`);
  return { role, tone, size };
}
export function inspectInputTheme(theme: InputTheme, viewport: number) {
  if (!Number.isFinite(viewport) || viewport < 0) throw new Error('UXD_INPUT_VIEWPORT: Expected a non-negative width.');
  const values: Record<string,string> = {};
  for (const rule of compileInputRules(theme)) if (rule.minWidth === null || rule.minWidth <= viewport) Object.assign(values, rule.values);
  return values;
}
export function inputComponentCss(theme: InputTheme, selector: string, role = 'contained', tone = '', size = '') {
  const {base, states} = inputDeclarations(theme, role, tone, size);
  const emit = (sel: string, declarations: Record<string,string>) => `${sel} { ${Object.entries(declarations).map(([key,value]) => `${key}: ${value};`).join(' ')} }`;
  const selectors = selector.split(',').map(value => value.trim());
  const render = (targets: string[], declarations: Record<string,string>) => {
    const { placeholder, ...regular } = declarations;
    const result = [emit(targets.join(', '), regular)];
    if (placeholder) result.push(emit(targets.map(value => `${value}::placeholder`).join(', '), { color: placeholder }));
    return result;
  };
  return [...render(selectors, base), ...Object.entries(states).flatMap(([state, declarations]) => render(selectors.flatMap(sel => INPUT_STATES[state].map(pseudo => `${sel}${pseudo}`)), declarations))].join('\n');
}
