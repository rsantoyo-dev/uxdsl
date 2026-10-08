import { BreakpointMap, DEFAULT_BREAKPOINTS, TokenContext, compileDensityRules, resolveResponsiveValue, validateBreakpoints, tokenValueToCss } from './language';
import { buildVarName } from './naming';
import { themeError } from './diagnostics';

/** JSON fields and the CSS property each one is: the public variable suffix
 * (`--uxdsl__typography__<role>-font-size`) and the declaration `@ds-typo`
 * emits (`font-size`) are the same name. */
export const TYPOGRAPHY_PROPERTIES = Object.freeze({
  fontFamily: 'font-family', fontSize: 'font-size', lineHeight: 'line-height',
  fontWeight: 'font-weight', letterSpacing: 'letter-spacing',
  textTransform: 'text-transform', textDecoration: 'text-decoration',
  fontStyle: 'font-style',
  marginBlockStart: 'margin-block-start', marginBlockEnd: 'margin-block-end',
});
export type TypographyStyle = Partial<Record<keyof typeof TYPOGRAPHY_PROPERTIES, string>>;
export type TypographyDetails = Record<string, TypographyStyle>;

/** The CSS property `@ds-typo` emits for each field — the same map as the
 * variable suffixes above, kept under its own name for the callers that read
 * it as "the property to emit". `@ds-typo` emits one declaration per field the
 * effective theme defines for the role, with no literal fallbacks. */
export const TYPOGRAPHY_CSS_PROPERTIES = TYPOGRAPHY_PROPERTIES;

/** The effective field set for one role: `default` underneath the role's own
 * fields, exactly as compileTypographyRules composes it when generating the
 * variables, so the directive can never consume a field the generator did not
 * define. Returns `null` for a role the theme does not define — a missing role
 * must fail with a location, never silently fall back to `default`. */
export function resolveTypographyRole(details: TypographyDetails, role: string): TypographyStyle | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
  if (!Object.prototype.hasOwnProperty.call(details, role)) return null;
  const style = details[role];
  if (!style || typeof style !== 'object' || Array.isArray(style)) return null;
  return role === 'default' ? { ...style } : { ...details.default, ...style };
}

/** Stability phase 1: the one value grammar. A typography field may reference
 * any token (`palette(primary)` in `letterSpacing`, `radius(2)`…), not only
 * `space()`/`density()`; the reference pass judges whether it exists. */
export function typographyValueToCss(input: string, context?: TokenContext): string {
  return tokenValueToCss(input, context);
}

export function compileTypographyRules(details: TypographyDetails, breakpoints: BreakpointMap = DEFAULT_BREAKPOINTS, context?: TokenContext) {
  if (details && typeof details === 'object' && !Array.isArray(details) && !Object.keys(details).length) return [];
  // Stability phase 1: the breakpoint map has one owner and one code
  // (`UXD_BP_INVALID`, language.ts); this engine no longer restates the
  // same rules under `UXD_TYPO_BP`.
  const ordered = validateBreakpoints(breakpoints);
  if (!details || typeof details !== 'object' || Array.isArray(details)) throw themeError('UXD_TYPO_DETAILS', 'Expected an object', 'typography_details');
  for (const [role, style] of Object.entries(details)) {
    if (!/^[a-z][a-z0-9-]*$/.test(role) || !style || typeof style !== 'object' || Array.isArray(style)) throw themeError('UXD_TYPO_ROLE', `Invalid style ${role}`, `typography_details.${role}`);
    for (const [field, value] of Object.entries(style)) {
      if (!Object.prototype.hasOwnProperty.call(TYPOGRAPHY_PROPERTIES, field) || typeof value !== 'string' || !value.trim()) throw themeError('UXD_TYPO_FIELD', `Invalid ${role}.${field}`, `typography_details.${role}.${field}`);
    }
  }
  const rules = ordered.map(([breakpoint, width], index) => ({ breakpoint, minWidth: index ? width : null as number | null, values: {} as Record<string, string> }));
  // Every role shares one "typography" family, so the emitted name is
  // `--uxdsl__typography__<role>-<property>` (`--uxdsl__typography__h1-font-size`).
  // Two role/field pairs cannot produce the same name: a role is
  // `^[a-z][a-z0-9-]*$` and no property name is a dash-suffix of another.
  for (const [role, style] of Object.entries(details)) {
    const merged = role === 'default' ? style : { ...details.default, ...style };
    for (const [field, expression] of Object.entries(merged)) {
      const varName = buildVarName('typography', `${role}-${TYPOGRAPHY_PROPERTIES[field as keyof TypographyStyle]}`);
      let previous: string | undefined;
      ordered.forEach(([bp], index) => {
        const value = typographyValueToCss(resolveResponsiveValue(expression!, bp, breakpoints), context);
        if (!value && index === 0) throw themeError('UXD_TYPO_BASE', `${role}.${field} needs a base value`, `typography_details.${role}.${field}`);
        if (value !== previous) rules[index].values[varName] = value;
        previous = value;
      });
    }
  }
  return rules.filter(rule => Object.keys(rule.values).length);
}

/** Pure generation used identically by PostCSS, SSR and browser applications. */
export function generateTypographyCss(theme: Record<string, any>, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }): string {
  const base: Record<string, string> = {};
  for (const [key, value] of Object.entries(theme.fonts?.families || {})) base[buildVarName('font', key)] = tokenValueToCss(String(value), theme);
  const serialize = (values: Record<string, string>) => `:root { ${Object.entries(values).map(([key, value]) => `${key}: ${value};`).join(' ')} }`;
  const output = Object.keys(base).length ? [serialize(base)] : [];
  for (const rule of compileTypographyRules(theme.typography_details || {}, breakpoints, theme)) {
    const body = serialize(rule.values);
    output.push(rule.minWidth === null ? body : `@media (min-width: ${rule.minWidth}px) { ${body} }`);
  }
  return output.join('\n');
}

/** Resolve the same generated custom properties for a simulated viewport. */
export function inspectTypographyTheme(theme: Record<string, any>, width: number): Record<string, string> {
  const bps = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints };
  const rules = [
    ...compileTypographyRules(theme.typography_details || {}, bps, theme),
    ...compileDensityRules(theme.densities || {}, bps, (value) => tokenValueToCss(value, theme)),
  ];
  const values: Record<string, string> = {};
  for (const rule of rules) {
    if ((rule.minWidth ?? 0) <= width) Object.assign(values, rule.values);
  }
  return values;
}
