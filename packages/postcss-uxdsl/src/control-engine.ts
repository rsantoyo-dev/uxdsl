import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import { SurfaceTheme, getSurfaceTokens, surfaceDeclarations, surfaceValueToCss, requireRole } from './surfaces';
import { parseDirectiveTokens, directiveArgumentsInner, toneError } from './directives';
import { DEFAULT_BREAKPOINTS, BreakpointMap, getToneFamilies } from './language';
import { compilePresetRules, mergePresetTokens } from './preset-engine';
import { buildVarName, buildNamespacedVarName, NameRegistry } from './naming';

export interface ControlRole { surface?: string; base?: Record<string, string>; states?: Record<string, Record<string, string>> }
export interface ControlTheme extends SurfaceTheme { [key: string]: any }

/** The three Palette variants a tone supplies; `tone(<variant>)` names one. */
export const TONE_VARIANTS = ['main', 'dark', 'contrast'] as const;

/**
 * Stability phase 1 (audit T6): `tone(main|dark|contrast)` is the value
 * function a Button/Input theme value uses to say "the requested tone's
 * variant, else primary's". It compiles to exactly the fallback chain the base
 * theme used to spell out by hand:
 *
 *   tone(dark)  ->  var(--uxdsl__button__tone-dark, var(--uxdsl__palette__primary-dark))
 *
 * and, in the per-tone variant of the same value (`<role>-tone-<family>-…`),
 * straight to that family's own variant. The literal chain is still recognised
 * for one release (deprecated): the regex substitution it relied on only ever
 * matched that exact text, which is why `states.hover.bg: 'palette(primary.dark)'`
 * never varied by tone — it was not the magic literal.
 */
export function toneReferences(value: string, family: 'input' | 'button', tone: string | null, fail: (message: string) => Error): string {
  const parsed = valueParser(value);
  parsed.walk(node => {
    if (node.type !== 'function' || node.value !== 'tone') return;
    const variant = valueParser.stringify(node.nodes).trim();
    if (!(TONE_VARIANTS as readonly string[]).includes(variant)) throw fail(`UXD_INPUT_TONE: tone(${variant}) is not a tone variant; use tone(main), tone(dark) or tone(contrast).`);
    Object.assign(node, { type: 'word', value: tone
      ? `var(${buildNamespacedVarName('palette', `${tone}-${variant}`)})`
      : `var(${buildVarName(family, `tone-${variant}`)}, var(${buildNamespacedVarName('palette', `primary-${variant}`)}))` });
    return false;
  });
  let out = parsed.toString();
  if (tone) {
    // Deprecated literal form. buildVarName/buildNamespacedVarName output has
    // no regex-special characters (letters, digits, hyphens, underscores)
    // other than the literal backreference placeholder appended below, so
    // it's safe to splice straight into the pattern.
    const literal = `var\\(${buildVarName(family, 'tone-')}(main|dark|contrast), var\\(${buildNamespacedVarName('palette', 'primary')}-\\1\\)\\)`;
    out = out.replace(new RegExp(literal, 'g'), (_, variant) => `var(${buildNamespacedVarName('palette', `${tone}-${variant}`)})`);
  }
  return out;
}

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
  // Every role/state/tone bucket shares one `family` namespace
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
      const untoned: Record<string, string> = {};
      for (const [key, value] of Object.entries(style)) {
        untoned[key] = toneReferences(value, family, null, fail);
        put(`${role}-${state}-${key}`, `${role}.${state}.${key}`, surfaceValueToCss(untoned[key], theme));
      }
      // Moved to language.ts as getToneFamilies, so
      // the vscode extension's completion generator can derive the exact
      // same tone list without duplicating this predicate by hand.
      //
      // Stability phase 1 (audit T8): a per-tone variant is emitted only when
      // the tone changes the value. Every compiled reference to one carries
      // the untoned variable as its var() fallback, so an omitted variant
      // resolves to exactly what the identical copy used to say — 341 of the
      // default output's 745 declarations were such copies
      // (`…-tone-<family>-disabled-opacity: 0.6`, eleven times over).
      for (const tone of getToneFamilies(theme.palette)) {
        for (const [key, value] of Object.entries(style)) {
          const toned = toneReferences(value, family, tone, fail);
          if (toned === untoned[key]) continue;
          put(`${role}-tone-${tone}-${state}-${key}`, `${role}.tone.${tone}.${state}.${key}`, surfaceValueToCss(toned, theme));
        }
      }
    }
  }
  return compilePresetRules({ [family]: bucket }, breakpoints, errorPrefix, theme);
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
  // `placeholder` (Input only — no other family defines
  // this field) needs a *different* tone rule than every other field, not
  // just a copy of the existing one. The regex-substitution mechanism above
  // (compileRules, the one that already tone-varies hover.bg/caret/etc.)
  // hard-codes its untoned fallback to the `primary` family — exactly right
  // for a control whose whole design is "primary-colored unless told
  // otherwise", but wrong for a placeholder, whose untoned default must stay
  // a neutral gray, not silently become `primary`. So this field is handled
  // here instead, in TypeScript, the same way surfaceDeclarations already
  // decides bg/color/border — and for the same reason: `composed.background`
  // already tells us, per role, whether the background is tone-colored
  // ('transparent' for outlined/flat means it is not). A gray placeholder
  // already reads fine on the untinted outlined/flat surfaces (nothing here
  // changes for them); it stops reading once the whole surface — including
  // outlined/flat's own tone-colored *text* — turns saturated, which is
  // exactly the `contained`-shaped case this substitutes for: the same
  // tone-contrast already used for that role's own text, so a typed value
  // and its placeholder share one legible color instead of two competing ones.
  if (tone && pack.base.placeholder !== undefined && base.background !== 'transparent') {
    base.placeholder = `var(${buildNamespacedVarName('palette', `${tone}-contrast`)})`;
  }
  return { base, states: Object.fromEntries(Object.entries(pack.states).map(([state, style]) => [state, refs(state, style)])) };
}
/** `@ds-<family>(role [tone] [size] [radius(k)] [shadow(k)])`: the grammar, then the role and tone against the theme. */
function parseArguments(theme: ControlTheme, input: string) {
  const directive = `ds-${family}`;
  const args = parseDirectiveTokens(directive, directiveArgumentsInner(directive, input));
  requireRole(directive, family === 'button' ? 'UXD_BUTTON_ROLE' : 'UXD_INPUT_ROLE', args.role, Object.keys(getTokens(theme)), theme.palette);
  if (args.tone) {
    const tones = getToneFamilies(theme.palette);
    if (!tones.includes(args.tone)) throw toneError(family === 'button' ? 'UXD_BUTTON_TONE' : 'UXD_INPUT_TONE', args.tone, tones);
  }
  return args;
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
  // A plain `.split(',')` also splits inside
  // functional pseudo-classes (`:is(.x, .y)`, `:where(...)`, `:not(...)`,
  // `:has(...)`) since they contain commas of their own — `.btn:is(.x, .y)`
  // became the two bogus selectors `.btn:is(.x` and `.y)`, and appending a
  // state like `:hover` to each produced the invalid, silently-wrong
  // `.btn:is(.x:hover, .y):hover`. `postcss.list.comma` is selector-aware
  // and only splits top-level commas, outside any parentheses.
  const selectors = postcss.list.comma(selector).map(value => value.trim());
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
