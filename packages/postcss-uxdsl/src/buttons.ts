import { SurfaceTheme, SURFACE_PROPERTIES, getSurfaceTokens, surfaceDeclarations, surfaceValueToCss } from './surfaces';
import { DEFAULT_BREAKPOINTS, BreakpointMap } from './language';
import { compilePresetRules, mergePresetTokens } from './preset-engine';

export const BUTTON_PROPERTIES: Record<string, string> = { ...SURFACE_PROPERTIES, opacity: 'opacity', outline: 'outline', 'outline-offset': 'outline-offset', transform: 'transform', cursor: 'cursor', 'font-weight': 'font-weight' };
export const BUTTON_STATES: Record<string, string[]> = { hover: [':hover'], active: [':active'], focus: [':focus'], focusvisible: [':focus-visible'], disabled: [':disabled', '[aria-disabled="true"]'], selected: ['.is-selected', '[aria-pressed="true"]', '[aria-selected="true"]'] };
export interface ButtonRole { surface?: string; base?: Record<string, string>; states?: Record<string, Record<string, string>> }
export interface ButtonTheme extends SurfaceTheme { buttons?: Record<string, ButtonRole> }
const dark = 'var(--button-tone-dark, var(--ds__palette__primary-dark))';
const main = 'var(--button-tone-main, var(--ds__palette__primary-main))';
const contrast = 'var(--button-tone-contrast, var(--ds__palette__primary-contrast))';
export const DEFAULT_BUTTONS: Record<string, ButtonRole> = {
  contained: { surface: 'contained', base: {}, states: { hover: { bg: dark, color: contrast }, selected: { bg: dark, color: contrast } } },
  outlined: { surface: 'outlined', base: {}, states: { hover: { color: dark, border: `1px solid ${dark}` }, selected: { bg: main, color: contrast, border: `1px solid ${main}` } } },
  flat: { surface: 'flat', base: {}, states: { hover: { color: dark }, selected: { color: dark } } },
};
for (const pack of Object.values(DEFAULT_BUTTONS)) {
  Object.freeze(pack.base);
  for (const state of Object.values(pack.states!)) Object.freeze(state);
  Object.freeze(pack.states); Object.freeze(pack);
}
Object.freeze(DEFAULT_BUTTONS);
function object(value: unknown): value is Record<string, any> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function fields(value: Record<string, string> = {}) {
  if (!object(value)) throw new Error('UXD_BUTTON_FIELDS: Expected an object.');
  for (const key of Object.keys(value)) if (!Object.hasOwnProperty.call(BUTTON_PROPERTIES, key)) throw new Error(`UXD_BUTTON_FIELD: Unknown ${key}.`);
  return mergePresetTokens({}, value, 'UXD_BUTTON');
}
export function getButtonTokens(theme: ButtonTheme = {}): Record<string, Required<ButtonRole>> {
  if (theme.buttons !== undefined && !object(theme.buttons)) throw new Error('UXD_BUTTON_MAP: Expected an object.');
  const result: Record<string, Required<ButtonRole>> = {};
  const surfaces = getSurfaceTokens(theme);
  for (const role of Array.from(new Set([...Object.keys(DEFAULT_BUTTONS), ...Object.keys(theme.buttons || {})]))) {
    const input = theme.buttons?.[role] || {};
    if (!/^[a-z][a-z0-9-]*$/.test(role) || !object(input) || (theme.buttons && role in theme.buttons && !theme.buttons[role])) throw new Error(`UXD_BUTTON_ROLE: Invalid ${role}.`);
    for (const key of Object.keys(input)) if (!['surface', 'base', 'states'].includes(key)) throw new Error(`UXD_BUTTON_FIELD: Unknown ${role}.${key}.`);
    const fallback = (Object.hasOwnProperty.call(DEFAULT_BUTTONS, role) ? DEFAULT_BUTTONS[role] : DEFAULT_BUTTONS.contained);
    const surface = input.surface === undefined ? fallback.surface! : input.surface;
    if (typeof surface !== 'string' || !Object.hasOwnProperty.call(surfaces, surface)) throw new Error(`UXD_BUTTON_SURFACE: Unknown ${surface}.`);
    if (input.states !== undefined && !object(input.states)) throw new Error('UXD_BUTTON_STATES: Expected an object.');
    const states: Record<string, Record<string,string>> = {};
    for (const key of Array.from(new Set([...Object.keys(fallback.states!), ...Object.keys(input.states || {})]))) {
      if (!Object.hasOwnProperty.call(BUTTON_STATES, key)) throw new Error(`UXD_BUTTON_STATE: Unknown ${key}.`);
      states[key] = { ...fallback.states?.[key], ...fields(input.states?.[key]) };
    }
    result[role] = { surface, base: { ...fallback.base, ...fields(input.base) }, states };
  }
  return result;
}
export function compileButtonRules(theme: ButtonTheme = {}, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }) {
  const groups: Record<string, Record<string,string>> = {};
  for (const [role, pack] of Object.entries(getButtonTokens(theme))) {
    for (const [state, style] of Object.entries({ base: pack.base, ...pack.states })) {
      groups[`button-${role}-${state}`] = Object.fromEntries(Object.entries(style).map(([key,value]) => [key, surfaceValueToCss(value, theme)]));
      if (state !== 'base') for (const tone of Object.keys(theme.palette || {}).filter(key => /^[a-z][a-z0-9-]*$/.test(key))) {
        groups[`button-${role}-tone-${tone}-${state}`] = Object.fromEntries(Object.entries(style).map(([key,value]) => [key, surfaceValueToCss(value.replace(/var\(--button-tone-(main|dark|contrast), var\(--ds__palette__primary-\1\)\)/g, (_, variant) => `var(--ds__palette__${tone}-${variant})`), theme)]));
      }
    }
  }
  return compilePresetRules(groups, breakpoints, 'UXD_BUTTON');
}
export function generateButtonCss(theme: ButtonTheme = {}, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }, selector = ':root') {
  return compileButtonRules(theme, breakpoints).map(rule => {
    const css = `${selector} { ${Object.entries(rule.values).map(([key,value]) => `${key}: ${value};`).join(' ')} }`;
    return rule.minWidth === null ? css : `@media (min-width: ${rule.minWidth}px) { ${css} }`;
  }).join('\n');
}
export function buttonDeclarations(theme: ButtonTheme, role = 'contained', tone = '', size = '') {
  const pack = getButtonTokens(theme)[role];
  if (!pack) throw new Error(`UXD_BUTTON_ROLE: Undefined ${role}.`);
  const refs = (state: string, style: Record<string,string>) => Object.fromEntries(Object.keys(style).map(key => [BUTTON_PROPERTIES[key], tone && state !== 'base' ? `var(--button-${role}-tone-${tone}-${state}-${key}, var(--button-${role}-${state}-${key}))` : `var(--button-${role}-${state}-${key})`]));
  const base = { ...surfaceDeclarations(theme, pack.surface, tone, size), ...refs('base', pack.base) };
  if (tone) for (const variant of ['main','dark','contrast']) base[`--button-tone-${variant}`] = `var(--ds__palette__${tone}-${variant})`;
  return { base, states: Object.fromEntries(Object.entries(pack.states).map(([state, style]) => [state, refs(state, style)])) };
}
export function parseButtonArguments(theme: ButtonTheme, input: string) {
  const parts = input.trim().replace(/^(['"])(.*)\1$/, '$2').replace(/^\((.*)\)$/, '$1').split(/[\s,]+/).filter(Boolean);
  const roles = getButtonTokens(theme);
  const role = parts.find(part => Object.hasOwnProperty.call(roles, part)) || 'contained';
  const rest = parts.filter(part => part !== role);
  const tone = rest.find(part => !/^\d+$/.test(part)) || '';
  const size = rest.find(part => /^\d+$/.test(part)) || '';
  if (rest.length > Number(!!tone) + Number(!!size) || (tone && (!/^[a-z][a-z0-9-]*$/.test(tone) || (!parts.some(part => Object.hasOwnProperty.call(roles, part)) && !Object.hasOwnProperty.call(theme.palette || {}, tone))))) throw new Error(`UXD_BUTTON_ARGUMENT: Invalid ${input}; use a configured role, Palette family and numeric size.`);
  return { role, tone, size };
}
export function inspectButtonTheme(theme: ButtonTheme, viewport: number) {
  if (!Number.isFinite(viewport) || viewport < 0) throw new Error('UXD_BUTTON_VIEWPORT: Expected a non-negative width.');
  const values: Record<string,string> = {};
  for (const rule of compileButtonRules(theme)) if (rule.minWidth === null || rule.minWidth <= viewport) Object.assign(values, rule.values);
  return values;
}
export function buttonComponentCss(theme: ButtonTheme, selector: string, role = 'contained', tone = '', size = '') {
  const {base, states} = buttonDeclarations(theme, role, tone, size);
  const emit = (sel: string, declarations: Record<string,string>) => `${sel} { ${Object.entries(declarations).map(([key,value]) => `${key}: ${value};`).join(' ')} }`;
  return [emit(selector, base), ...Object.entries(states).map(([state, declarations]) => emit(selector.split(',').flatMap(sel => BUTTON_STATES[state].map(pseudo => `${sel.trim()}${pseudo}`)).join(', '), declarations))].join('\n');
}
