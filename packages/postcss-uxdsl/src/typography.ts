import valueParser from 'postcss-value-parser';
import { BreakpointMap, DEFAULT_BREAKPOINTS, compileDensityRules, resolveResponsiveValue } from './language';
import { buildVarName, NameRegistry } from './naming';

/** JSON fields and their public CSS variable suffixes. */
export const TYPOGRAPHY_PROPERTIES = Object.freeze({
  fontFamily: 'font-family', fontSize: 'size', lineHeight: 'line',
  fontWeight: 'weight', letterSpacing: 'spacing', textTransform: 'transform',
  textDecoration: 'decoration', fontStyle: 'style',
  marginBlockStart: 'margin-block-start', marginBlockEnd: 'margin-block-end',
});
export type TypographyStyle = Partial<Record<keyof typeof TYPOGRAPHY_PROPERTIES, string>>;
export type TypographyDetails = Record<string, TypographyStyle>;

// Consumption fallbacks preserve the existing @ds-typo contract.
export const TYPOGRAPHY_DEFAULTS: Readonly<Record<string, { weight?: string; family: string; line: string; spacing?: string; opacity?: string }>> = Object.freeze({
  h1: { weight: '700', family: 'ui', line: '1.1', spacing: '-0.02em' },
  h2: { weight: '700', family: 'ui', line: '1.2', spacing: '-0.01em' },
  h3: { weight: '600', family: 'ui', line: '1.3', spacing: 'normal' },
  h4: { weight: '600', family: 'ui', line: '1.4', spacing: 'normal' },
  h5: { weight: '600', family: 'ui-2', line: '1.4', spacing: 'normal' },
  h6: { weight: '600', family: 'ui-2', line: '1.4', spacing: 'normal' },
  p: { weight: '400', family: 'ui', line: '1.6', spacing: 'normal' },
  span: { weight: '400', family: 'ui', line: '1.5', spacing: 'normal' },
  body: { weight: '400', family: 'ui', line: '1.6', spacing: 'normal' },
  small: { opacity: '0.8', family: 'ui-2', line: '1.4', spacing: 'normal' },
  caption: { opacity: '0.8', family: 'ui-2', line: '1.4', spacing: 'normal' },
  pre: { family: 'code', line: '1.5' }, code: { family: 'code', line: '1.5' },
});

export function typographyValueToCss(input: string): string {
  const parsed = valueParser(input);
  parsed.walk(node => {
    if (node.type !== 'function' || !['space', 'density'].includes(node.value)) return;
    const key = valueParser.stringify(node.nodes).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!/^[\w.-]+$/.test(key)) throw new Error(`UXD_TYPO_TOKEN: Invalid ${node.value} reference.`);
    Object.assign(node, { type: 'word', value: `var(--${node.value === 'space' ? 'space' : 'density'}-${key})` });
    return false;
  });
  return parsed.toString();
}

export function compileTypographyRules(details: TypographyDetails, breakpoints: BreakpointMap = DEFAULT_BREAKPOINTS) {
  if (details && typeof details === 'object' && !Array.isArray(details) && !Object.keys(details).length) return [];
  const ordered = Object.entries(breakpoints).sort((a, b) => a[1] - b[1]);
  if (!ordered.length || ordered[0][1] !== 0 || ordered.some(([, width]) => !Number.isFinite(width) || width < 0) || new Set(ordered.map(([, width]) => width)).size !== ordered.length) {
    throw new Error('UXD_TYPO_BP: Typography requires distinct non-negative breakpoint widths and a zero-width base.');
  }
  if (!details || typeof details !== 'object' || Array.isArray(details)) throw new Error('UXD_TYPO_DETAILS: Expected an object.');
  for (const [role, style] of Object.entries(details)) {
    if (!/^[a-z][a-z0-9-]*$/.test(role) || !style || typeof style !== 'object' || Array.isArray(style)) throw new Error(`UXD_TYPO_ROLE: Invalid style ${role}.`);
    for (const [field, value] of Object.entries(style)) {
      if (!Object.prototype.hasOwnProperty.call(TYPOGRAPHY_PROPERTIES, field) || typeof value !== 'string' || !value.trim()) throw new Error(`UXD_TYPO_FIELD: Invalid ${role}.${field}.`);
    }
  }
  const rules = ordered.map(([breakpoint, width], index) => ({ breakpoint, minWidth: index ? width : null as number | null, values: {} as Record<string, string> }));
  // MIG-08: a role like "h1-weight" combined with field "size" would
  // concatenate to the same name as role "h1" field "weight-size" — catch
  // that instead of one silently overwriting the other.
  const names = new NameRegistry('UXD_TYPO');
  for (const [role, style] of Object.entries(details)) {
    const merged = role === 'default' ? style : { ...details.default, ...style };
    for (const [field, expression] of Object.entries(merged)) {
      const varName = names.claim(buildVarName(role, TYPOGRAPHY_PROPERTIES[field as keyof TypographyStyle]), `${role}.${field}`);
      let previous: string | undefined;
      ordered.forEach(([bp], index) => {
        const value = typographyValueToCss(resolveResponsiveValue(expression!, bp, breakpoints));
        if (!value && index === 0) throw new Error(`UXD_TYPO_BASE: ${role}.${field} needs a base value.`);
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
