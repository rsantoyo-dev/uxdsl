import valueParser from 'postcss-value-parser';
import { BreakpointMap, DEFAULT_BREAKPOINTS, compileDensityRules, resolveResponsiveValue } from './language';
import { buildVarName, NameRegistry } from './naming';
import { themeError } from './diagnostics';

/** JSON fields and their public CSS variable suffixes. */
export const TYPOGRAPHY_PROPERTIES = Object.freeze({
  fontFamily: 'font-family', fontSize: 'size', lineHeight: 'line',
  fontWeight: 'weight', letterSpacing: 'spacing', textTransform: 'transform',
  textDecoration: 'decoration', fontStyle: 'style',
  marginBlockStart: 'margin-block-start', marginBlockEnd: 'margin-block-end',
});
export type TypographyStyle = Partial<Record<keyof typeof TYPOGRAPHY_PROPERTIES, string>>;
export type TypographyDetails = Record<string, TypographyStyle>;

/** The same JSON fields, mapped to the CSS property `@ds-typo` emits for each.
 * MIG-B6-17 (FEAT-008): `@ds-typo` used to emit a fixed list of declarations
 * with literal fallbacks the theme never asked for (`auto` margins that break
 * flex/grid, a `text-decoration: none` that stripped link underlines, an
 * `opacity` that could not be overridden from JSON at all because it is not a
 * field here). It now emits one declaration per field the effective theme
 * actually defines, so this map and TYPOGRAPHY_PROPERTIES must stay key-for-key
 * identical — test/typography.test.js guards that. The suffix map is the public
 * variable name (`fontSize` -> `--…-size`); this one is the CSS property
 * (`fontSize` -> `font-size`). They differ, so neither can be derived from the
 * other by camelCase conversion. */
export const TYPOGRAPHY_CSS_PROPERTIES = Object.freeze({
  fontFamily: 'font-family', fontSize: 'font-size', lineHeight: 'line-height',
  fontWeight: 'font-weight', letterSpacing: 'letter-spacing',
  textTransform: 'text-transform', textDecoration: 'text-decoration',
  fontStyle: 'font-style',
  marginBlockStart: 'margin-block-start', marginBlockEnd: 'margin-block-end',
});

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

export function typographyValueToCss(input: string): string {
  const parsed = valueParser(input);
  parsed.walk(node => {
    if (node.type !== 'function' || !['space', 'density'].includes(node.value)) return;
    const key = valueParser.stringify(node.nodes).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!/^[\w.-]+$/.test(key)) throw themeError('UXD_TYPO_TOKEN', `Invalid ${node.value} reference`, 'typography');
    Object.assign(node, { type: 'word', value: `var(${buildVarName(node.value === 'space' ? 'space' : 'density', key)})` });
    return false;
  });
  return parsed.toString();
}

export function compileTypographyRules(details: TypographyDetails, breakpoints: BreakpointMap = DEFAULT_BREAKPOINTS) {
  if (details && typeof details === 'object' && !Array.isArray(details) && !Object.keys(details).length) return [];
  const ordered = Object.entries(breakpoints).sort((a, b) => a[1] - b[1]);
  if (!ordered.length || ordered[0][1] !== 0 || ordered.some(([, width]) => !Number.isFinite(width) || width < 0) || new Set(ordered.map(([, width]) => width)).size !== ordered.length) {
    throw themeError('UXD_TYPO_BP', 'Typography requires distinct non-negative breakpoint widths and a zero-width base', 'breakpoints');
  }
  if (!details || typeof details !== 'object' || Array.isArray(details)) throw themeError('UXD_TYPO_DETAILS', 'Expected an object', 'typography_details');
  for (const [role, style] of Object.entries(details)) {
    if (!/^[a-z][a-z0-9-]*$/.test(role) || !style || typeof style !== 'object' || Array.isArray(style)) throw themeError('UXD_TYPO_ROLE', `Invalid style ${role}`, `typography_details.${role}`);
    for (const [field, value] of Object.entries(style)) {
      if (!Object.prototype.hasOwnProperty.call(TYPOGRAPHY_PROPERTIES, field) || typeof value !== 'string' || !value.trim()) throw themeError('UXD_TYPO_FIELD', `Invalid ${role}.${field}`, `typography_details.${role}.${field}`);
    }
  }
  const rules = ordered.map(([breakpoint, width], index) => ({ breakpoint, minWidth: index ? width : null as number | null, values: {} as Record<string, string> }));
  // MIG-08: every role shares one "typography" family instead of the role
  // itself being the family, so the emitted name is
  // `--uxdsl__typography__<role>-<field>` (e.g. `--uxdsl__typography__h1-size`),
  // matching every other family's `--uxdsl__<family>__<key>` shape. A role
  // like "h1-weight" combined with field "size" would still concatenate to
  // the same name as role "h1" field "weight-size" — the registry catches
  // that instead of one silently overwriting the other.
  const names = new NameRegistry('UXD_TYPO');
  for (const [role, style] of Object.entries(details)) {
    const merged = role === 'default' ? style : { ...details.default, ...style };
    for (const [field, expression] of Object.entries(merged)) {
      const varName = names.claim(buildVarName('typography', `${role}-${TYPOGRAPHY_PROPERTIES[field as keyof TypographyStyle]}`), `${role}.${field}`);
      let previous: string | undefined;
      ordered.forEach(([bp], index) => {
        const value = typographyValueToCss(resolveResponsiveValue(expression!, bp, breakpoints));
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
  for (const [key, value] of Object.entries(theme.fonts?.families || {})) base[buildVarName('font', key)] = String(value);
  const serialize = (values: Record<string, string>) => `:root { ${Object.entries(values).map(([key, value]) => `${key}: ${value};`).join(' ')} }`;
  const output = Object.keys(base).length ? [serialize(base)] : [];
  // Legacy flat variables share the same responsive resolver as structured fields.
  const previous: Record<string, string> = {};
  Object.entries(breakpoints).sort((a, b) => a[1] - b[1]).forEach(([bp, width], index) => {
    const values: Record<string, string> = {};
    for (const [key, expression] of Object.entries(theme.typography || {})) {
      const value = typographyValueToCss(resolveResponsiveValue(String(expression), bp, breakpoints));
      if (value !== previous[key]) values[`--${key}`] = value;
      previous[key] = value;
    }
    if (Object.keys(values).length) {
      const body = serialize(values);
      output.push(index ? `@media (min-width: ${width}px) { ${body} }` : body);
    }
  });
  for (const rule of compileTypographyRules(theme.typography_details || {}, breakpoints)) {
    const body = serialize(rule.values);
    output.push(rule.minWidth === null ? body : `@media (min-width: ${rule.minWidth}px) { ${body} }`);
  }
  return output.join('\n');
}

/** Resolve the same generated custom properties for a simulated viewport. */
export function inspectTypographyTheme(theme: Record<string, any>, width: number): Record<string, string> {
  const bps = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints };
  const rules = [
    ...compileTypographyRules(theme.typography_details || {}, bps),
    ...compileDensityRules(theme.densities || {}, bps),
  ];
  const values: Record<string, string> = {};
  for (const rule of rules) {
    if ((rule.minWidth ?? 0) <= width) Object.assign(values, rule.values);
  }
  return values;
}
