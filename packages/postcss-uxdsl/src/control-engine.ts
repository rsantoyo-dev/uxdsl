import { SurfaceTheme, getSurfaceTokens, surfaceDeclarations, surfaceValueToCss, parseOverrideArguments } from './surfaces';
import { DEFAULT_BREAKPOINTS, BreakpointMap } from './language';
import { compilePresetRules, mergePresetTokens } from './preset-engine';
import { buildVarName, buildNamespacedVarName, NameRegistry } from './naming';

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
  // MIG-08: every role/state/tone bucket shares one `family` namespace
  // (`button`/`input`) instead of folding role/state into the family
  // portion, so the emitted name is `--uxdsl__button__<role>-<state>-<key>`
  // (e.g. `--uxdsl__button__contained-hover-bg`), matching every other
  // family's `--uxdsl__<family>__<key>` shape. Each composite key is
  // claimed through a registry (identifier `role.state.key`) before it
  // reaches the shared bucket object, so two different (role, state, key)
  // triples that happen to concatenate to the identical string (e.g. role
  // "a-b" state "c" vs role "a" state "b-c") raise a clear collision
  // instead of one silently overwriting the other as a plain object
  // property — compilePresetRules's own registry only sees the bucket
  // after that has already happened.
  const bucket: Record<string, string> = {};
  const names = new NameRegistry(errorPrefix);
  const put = (comboKey: string, identifier: string, value: string) => { bucket[names.claim(comboKey, identifier)] = value; };
  for (const [role, pack] of Object.entries(getTokens(theme))) {
    for (const [state, style] of Object.entries({ base: pack.base, ...pack.states })) {
      for (const [key, value] of Object.entries(style)) put(`${role}-${state}-${key}`, `${role}.${state}.${key}`, surfaceValueToCss(value, theme));
      // A tone must be a full color family (main/dark/contrast), not a
      // semantic overlay group like text/divider/action that only defines
      // the sub-keys it actually needs.
      for (const tone of Object.keys(theme.palette || {}).filter(key => /^[a-z][a-z0-9-]*$/.test(key) && object((theme.palette as any)[key]) && ['main', 'dark', 'contrast'].every(variant => variant in (theme.palette as any)[key]))) {
        // buildVarName/buildNamespacedVarName output has no regex-special
        // characters (letters, digits, hyphens, underscores) other than the
        // literal backreference placeholder appended below, so it's safe to
        // splice straight into the pattern.
        const primaryTonePattern = `var\\(${buildVarName(family, 'tone-')}(main|dark|contrast), var\\(${buildNamespacedVarName('palette', 'primary')}-\\1\\)\\)`;
        for (const [key, value] of Object.entries(style)) {
          put(`${role}-tone-${tone}-${state}-${key}`, `${role}.tone.${tone}.${state}.${key}`, surfaceValueToCss(value.replace(new RegExp(primaryTonePattern, 'g'), (_, variant) => `var(${buildNamespacedVarName('palette', `${tone}-${variant}`)})`), theme));
        }
      }
    }
  }
  return compilePresetRules({ [family]: bucket }, breakpoints, errorPrefix);
}
function generateCss(theme: ControlTheme = {}, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }, selector = ':root') {
  return compileRules(theme, breakpoints).map(rule => {
    const css = `${selector} { ${Object.entries(rule.values).map(([key,value]) => `${key}: ${value};`).join(' ')} }`;
    return rule.minWidth === null ? css : `@media (min-width: ${rule.minWidth}px) { ${css} }`;
  }).join('\n');
}
function declarations(theme: ControlTheme, role = 'contained', tone = '', size = '', radiusOverride = '', shadowOverride = '') {
  const pack = getTokens(theme)[role];
  if (!pack) throw fail(`UXD_INPUT_ROLE: Undefined ${role}.`);
  const refs = (state: string, style: Record<string,string>) => Object.fromEntries(Object.keys(style).map(key => [properties[key], tone ? `var(${buildVarName(family, `${role}-tone-${tone}-${state}-${key}`)}, var(${buildVarName(family, `${role}-${state}-${key}`)}))` : `var(${buildVarName(family, `${role}-${state}-${key}`)})`]));
  const composed = surfaceDeclarations(theme, pack.surface, tone, size, radiusOverride, shadowOverride);
  const base: Record<string,string> = { ...nativeDefaults, ...composed, ...refs('base', pack.base) };
  // An explicit radius()/shadow() override argument is a per-usage-site
  // decision; it must win even when the role's own `base` fields declare
  // radius/shadow (properties['radius'|'shadow'] === 'border-radius' |
  // 'box-shadow'), which refs('base', pack.base) would otherwise apply
  // last and silently reintroduce the value the override was meant to
  // replace.
  if (radiusOverride) base['border-radius'] = composed['border-radius'];
  if (shadowOverride) base['box-shadow'] = composed['box-shadow'];
  if (tone) for (const variant of ['main','dark','contrast']) base[buildVarName(family, `tone-${variant}`)] = `var(${buildNamespacedVarName('palette', `${tone}-${variant}`)})`;
  return { base, states: Object.fromEntries(Object.entries(pack.states).map(([state, style]) => [state, refs(state, style)])) };
}
// MIG-05: radius()/shadow() override arguments are extracted before the
// existing role/tone/size detection runs, so they compose with tone-only
// and legacy invocations without changing how those are parsed.
function parseArguments(theme: ControlTheme, input: string) {
  const allParts = input.trim().replace(/^(['"])(.*)\1$/, '$2').replace(/^\((.*)\)$/, '$1').split(/[\s,]+/).filter(Boolean);
  const { radius, shadow, rest: parts } = parseOverrideArguments(allParts, errorPrefix);
  const roles = getTokens(theme);
  const role = parts.find(part => Object.hasOwnProperty.call(roles, part)) || 'contained';
  const rest = parts.filter(part => part !== role);
  const tone = rest.find(part => !/^\d+$/.test(part)) || '';
  const size = rest.find(part => /^\d+$/.test(part)) || '';
  if (rest.length > Number(!!tone) + Number(!!size) || (tone && (!/^[a-z][a-z0-9-]*$/.test(tone) || (!parts.some(part => Object.hasOwnProperty.call(roles, part)) && !Object.hasOwnProperty.call(theme.palette || {}, tone))))) throw fail(`UXD_INPUT_ARGUMENT: Invalid ${input}; use a configured role, Palette family, numeric size and optional radius()/shadow() overrides.`);
  return { role, tone, size, radius: radius || '', shadow: shadow || '' };
}
function inspectTheme(theme: ControlTheme, viewport: number) {
  if (!Number.isFinite(viewport) || viewport < 0) throw fail('UXD_INPUT_VIEWPORT: Expected a non-negative width.');
  const values: Record<string,string> = {};
  for (const rule of compileRules(theme)) if (rule.minWidth === null || rule.minWidth <= viewport) Object.assign(values, rule.values);
  return values;
}
function componentCss(theme: ControlTheme, selector: string, role = 'contained', tone = '', size = '', radiusOverride = '', shadowOverride = '') {
  const {base, states} = declarations(theme, role, tone, size, radiusOverride, shadowOverride);
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
