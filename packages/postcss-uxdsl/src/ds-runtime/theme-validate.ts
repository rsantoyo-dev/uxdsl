import { compileDensityRules, getDensityTokens, validateBreakpoints, DEFAULT_BREAKPOINTS } from '../language';
import { compileInputRules } from '../inputs';
import { compileButtonRules } from '../buttons';
import { compileSurfaceRules } from '../surfaces';
import { compileShadowRules } from '../shadows';
import { compileEdgeRules } from '../edges';
import { compileTypographyRules, generateTypographyCss } from '../typography';
import { generateFoundationCss } from '../foundations';
import { renderThemeCss } from './theme-generator';
import { resolveTheme } from '../default-theme';
import { diagnosticCode, themeError } from '../diagnostics';
import postcss, { Declaration } from 'postcss';
import { enforceReferences, ReferenceIntegrityError, ReferenceOptions } from '../reference-integrity';

export type ThemeValidationIssue = {
  /** The `UXD_*` code. Structural problems are `UXD_THEME_INVALID`; an engine or
   * reference problem carries that engine's own code. The unknown-family
   * warning is `UXD_THEME_FAMILY`. */
  code?: string;
  path: string;
  message: string;
};

export type ThemeValidationResult<TTheme extends Record<string, any>> = {
  ok: boolean;
  /** A deep copy of the input, unchanged: the validator never normalizes. */
  theme: TTheme;
  errors: ThemeValidationIssue[];
  warnings: ThemeValidationIssue[];
};

export interface ValidateThemeOptions {
  /** Reference-integrity options for the generated theme. `false` skips the
   * reference pass entirely (the PostCSS plugin does, because it checks the
   * references of the exact stylesheet it emits, once at the end). */
  references?: ReferenceOptions | false;
}

// MIG-B3-03 (FEAT-004), MIG-B6-01 (FEAT-008): every top-level theme family
// the compiler and theme generator read. The top-level set is closed: a key
// outside it is either a typo or unused data. `theme-families-drift.test.js`
// scans source reads to keep this public registry synchronized for CLI strict
// validation and the theme schema.
export const KNOWN_THEME_FAMILIES = new Set([
  'breakpoints', 'spacing', 'palette', 'fonts', 'colors', 'typography_details',
  'densities', 'inputs', 'buttons', 'surfaces', 'shadows', 'borders', 'radii',
  'modes',
]);

/**
 * MIG-B6-27 (FEAT-008): JSON Schema metadata, recognized but deliberately
 * **not** a member of `KNOWN_THEME_FAMILIES` — it names no tokens and compiles
 * to nothing, so treating it as a family would put it in the schema's own
 * family list, in strict-theme scopes and in every drift check. It is accepted
 * where a theme is validated, and ignored everywhere a family is consumed.
 */
export const THEME_SCHEMA_KEY = '$schema';

// Stability phase 1: the three lexical rules every theme key and leaf obeys.
// The JSON Schema (scripts/generate-language-artifacts.js) is generated from
// these same patterns, so an editor and the compiler reject the same names.
//
// A name is a role, family or breakpoint: typography roles, surfaces, buttons,
// inputs, palette and color families, font-family names, breakpoint names.
// Lowercase, starting with a letter — a key becomes a segment of a CSS custom
// property (`--uxdsl__<family>__<key>`), where `__` is the namespace separator
// and letter case would otherwise let `H1` and `h1` name two variables the
// compiler could never tell apart in a directive.
export const THEME_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
// A token key may also start with a digit: spacing `1`, density `0`, a color
// shade `300`, a palette variant `main`.
export const THEME_KEY_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
// A leaf is a nonempty (not blank) CSS value. `;`, `{` and `}` never belong
// in one — the theme is compiled to a stylesheet, and a value carrying them
// could inject rules (audit finding T3). Parentheses must also balance; a
// regex cannot express that, so the schema states only this pattern.
// `fonts.google` entries are Google Fonts specs (`Inter:wght@400;700`), not
// CSS values: they are percent-encoded into a URL, so only "nonempty" applies.
export const THEME_VALUE_PATTERN = /^\s*[^\s;{}][^;{}]*$/;

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'object') return 'an object';
  if (typeof value === 'string') return value.trim() ? 'a string' : 'an empty string';
  return `${typeof value} ${String(value)}`;
}

function balancedParentheses(value: string): boolean {
  let depth = 0;
  let quote: string | null = null;
  for (const ch of value) {
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')' && --depth < 0) return false;
  }
  return depth === 0;
}

/**
 * MIG-B6-30 (FEAT-008): a real deep copy of theme data.
 *
 * `deepMergeTheme({}, input)` reads like one but is not: with an empty base
 * every key takes the `out[key] = nextVal` branch, so nested objects are shared
 * with the input by reference (only arrays are sliced). The validator used that
 * as its "work on a copy" step and therefore normalized *the caller's* object
 * in place — invisible when the input was a freshly parsed JSON literal, and a
 * hard `TypeError` the moment the input shared a sub-object with the deep-frozen
 * packaged base, which is exactly what `resolveTheme()` returns.
 */
export function cloneThemeValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneThemeValue(item)) as any;
  if (!isPlainObject(value)) return value;
  const out: Record<string, any> = {};
  for (const key of Object.keys(value as any)) out[key] = cloneThemeValue((value as any)[key]);
  return out as any;
}

export function deepMergeTheme<TBase extends Record<string, any>, TOverride extends Record<string, any>>(
  base: TBase,
  override: TOverride
): TBase & TOverride {
  if (!isPlainObject(base)) return override as any;
  if (!isPlainObject(override)) return base as any;

  const out: Record<string, any> = { ...base };
  Object.keys(override).forEach((key) => {
    const nextVal = (override as any)[key];
    if (nextVal === undefined) return;

    const prevVal = (base as any)[key];
    if (Array.isArray(nextVal)) {
      out[key] = nextVal.slice();
      return;
    }
    if (isPlainObject(prevVal) && isPlainObject(nextVal)) {
      out[key] = deepMergeTheme(prevVal, nextVal);
      return;
    }
    out[key] = nextVal;
  });
  return out as any;
}

/**
 * The one theme validator (stability phase 1, audit finding T2).
 *
 * Called by the PostCSS plugin (on the effective theme, before any engine),
 * by `generateThemeCss`, by `applyTheme` and by the CLI, so every path answers
 * "is this theme valid?" identically. Three passes, in order:
 *
 * 1. Structure. Every leaf is a nonempty string with no `;`/`{`/`}` and
 *    balanced parentheses; a number, boolean, `null`, array or object where a
 *    string is expected is `UXD_THEME_INVALID` with the key path. Nothing is
 *    coerced: `"768"` is not a breakpoint and `700` is not a font weight.
 *    `fonts` is closed to `families`/`google` (a string array, no empty
 *    strings), `modes` to `dark` and `modes.dark` to `palette`; palette
 *    families are objects; keys follow `THEME_NAME_PATTERN`/`THEME_KEY_PATTERN`.
 * 2. Breakpoints, once: `validateBreakpoints` (a zero-width base, distinct,
 *    finite, non-negative widths) as `UXD_BP_INVALID`. Engines no longer
 *    re-check the map under their own family code.
 * 3. Engines: the same `compile*Rules`/generators the two CSS paths run, so
 *    closed field sets (`UXD_TYPO_FIELD`, `UXD_BUTTON_STATE`, …) and
 *    responsive expressions are judged by their owner. Then, unless
 *    `references` is `false`, the generated theme's references.
 *
 * An unknown top-level family is a warning (`UXD_THEME_FAMILY`), never an
 * error: nothing consumes the key, and this validator cannot tell a typo from
 * a family a newer version knows about. The result's `theme` is a deep copy of
 * the input — the validator never normalizes.
 */
export function validateTheme<TTheme extends Record<string, any>>(
  input: unknown,
  opts: ValidateThemeOptions = {}
): ThemeValidationResult<TTheme> {
  const errors: ThemeValidationIssue[] = [];
  const warnings: ThemeValidationIssue[] = [];
  const invalid = (path: string, message: string) => {
    errors.push({ code: 'UXD_THEME_INVALID', path, message: themeError('UXD_THEME_INVALID', message, path).message });
  };

  const theme: Record<string, any> = isPlainObject(input) ? cloneThemeValue(input as Record<string, any>) : {};
  if (!isPlainObject(input)) {
    invalid('theme', `Expected the theme to be an object, got ${describe(input)}`);
    return { ok: false, theme: theme as TTheme, errors, warnings };
  }

  // --- 1. structure -----------------------------------------------------------
  const leaf = (path: string, value: unknown) => {
    if (typeof value !== 'string' || !value.trim()) {
      invalid(path, `Expected a nonempty string, got ${describe(value)}`);
      return;
    }
    if (!THEME_VALUE_PATTERN.test(value)) invalid(path, 'A theme value cannot contain ";", "{" or "}"');
    else if (!balancedParentheses(value)) invalid(path, 'Unbalanced parentheses');
  };
  const object = (path: string, value: unknown, what = 'an object'): value is Record<string, any> => {
    if (isPlainObject(value)) return true;
    invalid(path, `Expected ${what}, got ${describe(value)}`);
    return false;
  };
  const name = (path: string, key: string, pattern: RegExp) => {
    if (pattern.test(key)) return true;
    invalid(path, pattern === THEME_NAME_PATTERN
      ? `Invalid name "${key}": use lowercase letters, digits and hyphens, starting with a letter`
      : `Invalid key "${key}": use lowercase letters, digits and hyphens`);
    return false;
  };
  const stringMap = (path: string, value: unknown, pattern: RegExp) => {
    if (!object(path, value)) return;
    for (const [key, entry] of Object.entries(value)) {
      const entryPath = `${path}.${key}`;
      if (name(entryPath, key, pattern)) leaf(entryPath, entry);
    }
  };
  const roleMap = (path: string, value: unknown, role: (rolePath: string, style: Record<string, any>) => void) => {
    if (!object(path, value)) return;
    for (const [key, style] of Object.entries(value)) {
      const rolePath = `${path}.${key}`;
      if (name(rolePath, key, THEME_NAME_PATTERN) && object(rolePath, style)) role(rolePath, style);
    }
  };
  const fields = (path: string, style: Record<string, any>) => { for (const [field, value] of Object.entries(style)) leaf(`${path}.${field}`, value); };
  const palette = (path: string, value: unknown) => {
    if (!object(path, value)) return;
    for (const [family, variants] of Object.entries(value)) {
      const familyPath = `${path}.${family}`;
      if (!name(familyPath, family, THEME_NAME_PATTERN)) continue;
      if (!object(familyPath, variants, 'an object of variants (a palette family is not a single color)')) continue;
      stringMap(familyPath, variants, THEME_KEY_PATTERN);
    }
  };
  const control = (path: string, value: unknown) => roleMap(path, value, (rolePath, pack) => {
    for (const [key, entry] of Object.entries(pack)) {
      const entryPath = `${rolePath}.${key}`;
      if (key === 'surface') leaf(entryPath, entry);
      else if (key === 'base') { if (object(entryPath, entry)) fields(entryPath, entry); }
      else if (key === 'states') roleMap(entryPath, entry, (statePath, style) => fields(statePath, style));
      else invalid(entryPath, `Unknown key "${key}"; a role has "surface", "base" and "states"`);
    }
  });
  const closed = (path: string, value: Record<string, any>, keys: string[]) => {
    for (const key of Object.keys(value)) if (!keys.includes(key)) invalid(`${path}.${key}`, `Unknown key "${key}"; ${path} accepts ${keys.map((k) => `"${k}"`).join(' and ')}`);
  };

  let breakpointsValid = true;
  for (const [family, value] of Object.entries(theme)) {
    if (family === THEME_SCHEMA_KEY) continue;
    switch (family) {
      case 'breakpoints':
        if (!object(family, value)) { breakpointsValid = false; break; }
        for (const [key, width] of Object.entries(value)) {
          const path = `${family}.${key}`;
          if (!name(path, key, THEME_NAME_PATTERN)) { breakpointsValid = false; continue; }
          if (typeof width !== 'number' || !Number.isFinite(width)) {
            invalid(path, `Expected a finite number of pixels, got ${describe(width)}`);
            breakpointsValid = false;
          }
        }
        break;
      case 'spacing':
        if (!object(family, value)) break;
        for (const [key, entry] of Object.entries(value)) {
          const path = `${family}.${key}`;
          if (name(path, key, THEME_KEY_PATTERN)) leaf(path, entry);
        }
        break;
      case 'densities': case 'radii': case 'borders': case 'shadows':
        stringMap(family, value, THEME_KEY_PATTERN);
        break;
      case 'typography':
        // The flat family (`typography: { 'font-code': … }`, emitted as the
        // un-namespaced `--font-code`) is gone. An error rather than the
        // unknown-family warning: the key was valid, so its replacement is named.
        invalid(family, 'The flat "typography" family was removed; define text roles in "typography_details" and font stacks in "fonts.families"');
        break;
      case 'colors':
        if (!object(family, value)) break;
        for (const [key, entry] of Object.entries(value)) {
          const path = `${family}.${key}`;
          if (!name(path, key, THEME_NAME_PATTERN)) continue;
          if (isPlainObject(entry)) stringMap(path, entry, THEME_KEY_PATTERN); else leaf(path, entry);
        }
        break;
      case 'palette':
        palette(family, value);
        break;
      case 'modes':
        if (!object(family, value)) break;
        closed(family, value, ['dark']);
        if (value.dark !== undefined && object('modes.dark', value.dark)) {
          closed('modes.dark', value.dark, ['palette']);
          if (value.dark.palette !== undefined) palette('modes.dark.palette', value.dark.palette);
        }
        break;
      case 'fonts':
        if (!object(family, value)) break;
        closed(family, value, ['families', 'google']);
        if (value.families !== undefined) stringMap('fonts.families', value.families, THEME_NAME_PATTERN);
        if (value.google !== undefined) {
          if (!Array.isArray(value.google)) invalid('fonts.google', `Expected an array of Google Fonts family specs, got ${describe(value.google)}`);
          else value.google.forEach((spec: unknown, index: number) => {
            if (typeof spec !== 'string' || !spec.trim()) invalid(`fonts.google.${index}`, `Expected a nonempty Google Fonts family spec, got ${describe(spec)}`);
          });
        }
        break;
      case 'typography_details': case 'surfaces':
        roleMap(family, value, fields);
        break;
      case 'buttons': case 'inputs':
        control(family, value);
        break;
      default:
        // MIG-B3-03: an unknown top-level family is exactly the "silent
        // fallback" gap that lets a theme-file/build-config collision (or a
        // plain typo like `color` for `colors`) go unnoticed — nothing
        // consumes the key, so it neither errors nor visibly does anything.
        // A warning, not an error: this validator has no way to distinguish
        // "typo" from "a family this version doesn't know about yet" from
        // "genuinely unused scratch data".
        warnings.push({ code: 'UXD_THEME_FAMILY', path: family, message: `Unknown theme family "${family}" — it will not be compiled into any CSS.` });
    }
  }

  // --- 2. breakpoints, once ---------------------------------------------------
  const bps: Record<string, number> = { ...DEFAULT_BREAKPOINTS, ...(isPlainObject(theme.breakpoints) ? theme.breakpoints : {}) };
  if (breakpointsValid) {
    try { validateBreakpoints(bps); }
    catch (cause) {
      breakpointsValid = false;
      errors.push({ code: 'UXD_BP_INVALID', path: breakpointPath(bps, theme.breakpoints), message: cause instanceof Error ? cause.message : String(cause) });
    }
  }

  // --- 3. engines ---------------------------------------------------------------
  // Only once the map is valid: every engine would otherwise repeat the same
  // breakpoint complaint under its own family.
  if (breakpointsValid) {
    const engine = (family: string, run: () => void) => {
      try { run(); }
      catch (cause) {
        errors.push({ code: diagnosticCode(cause), path: (cause as any)?.keyPath || family, message: cause instanceof Error ? cause.message : String(cause) });
      }
    };
    engine('theme', () => { generateFoundationCss(theme); });
    engine('fonts', () => { generateTypographyCss({ ...theme, typography_details: undefined }, bps); });
    if (theme.typography_details) engine('typography_details', () => { compileTypographyRules(theme.typography_details, bps); });
    engine('densities', () => { compileDensityRules(getDensityTokens(theme), bps); });
    engine('inputs', () => { compileInputRules(theme, bps); });
    engine('buttons', () => { compileButtonRules(theme, bps); });
    engine('surfaces', () => { compileSurfaceRules(theme, bps); });
    engine('shadows', () => { compileShadowRules(theme, bps); });
    engine('borders/radii', () => { compileEdgeRules(theme, bps); });
  }

  if (!errors.length && opts.references !== false) {
    const references = opts.references || {};
    try {
      const css = renderThemeCss(resolveTheme(theme));
      const root = postcss.parse(css);
      const declarations: Declaration[] = [];
      root.walkDecls((node) => { declarations.push(node); });
      enforceReferences(root, declarations, { ...references, onWarning: (issue) => {
        warnings.push({ code: issue.code, path: issue.chain.join(' -> '), message: issue.message });
        references.onWarning?.(issue);
      } });
    } catch (cause) {
      if (cause instanceof ReferenceIntegrityError) {
        for (const issue of cause.issues) errors.push({ code: issue.code, path: issue.chain.join(' -> '), message: issue.message });
      } else errors.push({ code: diagnosticCode(cause), path: (cause as any)?.keyPath || 'theme', message: cause instanceof Error ? cause.message : String(cause) });
    }
  }

  return { ok: errors.length === 0, theme: theme as TTheme, errors, warnings };
}

/** Which configured breakpoint `validateBreakpoints` objected to, for the
 * issue's path: a negative or duplicated width, else a base that is not 0. */
function breakpointPath(bps: Record<string, number>, configured: unknown): string {
  const own = isPlainObject(configured) ? Object.keys(configured) : [];
  const widths = Object.values(bps);
  const culprit = own.find((key) => bps[key] < 0 || widths.filter((width) => width === bps[key]).length > 1)
    || own.find((key) => bps[key] === Math.min(...widths) && bps[key] !== 0);
  return culprit ? `breakpoints.${culprit}` : 'breakpoints';
}

/**
 * Turns a failed validation into the error the CSS paths throw: the first
 * issue's message (with its key path, so the CLI can name the theme file),
 * followed by any others, one per line.
 */
export function themeValidationError(errors: ThemeValidationIssue[]): Error {
  const [first, ...rest] = errors;
  const error = new Error(rest.length ? `${first.message}\n  - ${rest.map((issue) => issue.message).join('\n  - ')}` : first.message);
  if (first.code) (error as any).code = first.code;
  if (first.path && first.path !== 'theme' && !first.path.includes(' -> ')) (error as any).keyPath = first.path;
  (error as any).issues = errors;
  return error;
}

