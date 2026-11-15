import valueParser from 'postcss-value-parser';
import { BreakpointMap, TokenContext, resolveResponsiveValue, validateBreakpoints, validateResponsiveExpression, tokenValueToCss } from './language';
import { buildVarName, NameRegistry } from './naming';
import { themeError } from './diagnostics';

// The value grammar lives in language.ts (`tokenValueToCss`,
// `RADIUS_KEYWORDS`) so every engine — foundations, typography, densities and
// these presets — serializes a theme value the same way.
export { RADIUS_KEYWORDS } from './language';

/** @deprecated Use `tokenValueToCss` (language.ts). The error prefix is
 * ignored — a bad alpha is `UXD_TOKEN_ALPHA` whichever family the value
 * belongs to — and no family has a serializer of its own: `palette()`,
 * `space()` and `color()` always compile to their `--uxdsl__` variable. */
export function presetValueToCss(input: string, _errorPrefix?: string): string {
  return tokenValueToCss(input);
}

// `keyPathPrefix` is optional: a caller that knows which top-level theme
// family it validates (edges.ts, for `radii`/`borders`) passes it, turning
// `UXD_EDGE_VALUE: Invalid token 1.` into a located
// `UXD_EDGE_VALUE: Invalid token 1 (at radii.1).` with `.keyPath` set, so
// `{ radii: { '1': '' } }` names the family and key that are wrong. Callers
// that merge one role (surfaces.ts, control-engine.ts) leave it out.
export function mergePresetTokens(defaults: Record<string, string>, input: Record<string, string> | undefined, errorPrefix: string, keyPathPrefix?: string) {
  if (input !== undefined && (!input || typeof input !== 'object' || Array.isArray(input))) {
    throw keyPathPrefix
      ? themeError(`${errorPrefix}_MAP`, 'Expected an object', keyPathPrefix)
      : new Error(`${errorPrefix}_MAP: Expected an object.`);
  }
  for (const [key, value] of Object.entries(input || {})) {
    const keyPath = keyPathPrefix ? `${keyPathPrefix}.${key}` : undefined;
    if (!/^[\w-]+$/.test(key) || typeof value !== 'string' || !value.trim() || /[;{}]/.test(value)) {
      throw keyPath ? themeError(`${errorPrefix}_VALUE`, `Invalid token ${key}`, keyPath) : new Error(`${errorPrefix}_VALUE: Invalid token ${key}.`);
    }
    valueParser(value).walk(node => {
      if ((node as any).unclosed) {
        throw keyPath ? themeError(`${errorPrefix}_VALUE`, `Unclosed expression for ${key}`, keyPath) : new Error(`${errorPrefix}_VALUE: Unclosed expression for ${key}.`);
      }
    });
  }
  return { ...defaults, ...input };
}

export function compilePresetRules(tokens: Record<string, Record<string, string>>, breakpoints: BreakpointMap, errorPrefix: string, context?: TokenContext) {
  // The breakpoint map has one owner and one code
  // (`UXD_BP_INVALID`), not one `<FAMILY>_BP` restatement per engine. A value
  // naming a breakpoint the map does not have is a value error, `_VALUE`.
  const ordered = validateBreakpoints(breakpoints);
  const rules = ordered.map(([breakpoint, width], i) => ({ breakpoint, minWidth: i ? width : null as number | null, values: {} as Record<string, string> }));
  // Two different (family, key) pairs — e.g. surface role
  // "contained-shadow" with no field suffix, and role "contained" field
  // "shadow" — can concatenate to the identical CSS variable name. Without
  // this, the second one to run would silently overwrite the first's
  // declaration; the registry turns that into a clear diagnostic instead.
  const names = new NameRegistry(errorPrefix);
  for (const family of Object.keys(tokens)) {
    for (const [key, expression] of Object.entries(tokens[family])) {
      validateResponsiveExpression(expression, breakpoints, `${errorPrefix}_VALUE`);
      const varName = names.claim(buildVarName(family, key), `${family}.${key}`);
      let previous: string | undefined;
      ordered.forEach(([bp], i) => {
        const value = tokenValueToCss(resolveResponsiveValue(expression, bp, breakpoints), context);
        if (!value && i === 0) throw new Error(`${errorPrefix}_BASE: ${family}.${key} needs a base value.`);
        if (value !== previous) rules[i].values[varName] = value;
        previous = value;
      });
    }
  }
  return rules.filter(rule => Object.keys(rule.values).length);
}
