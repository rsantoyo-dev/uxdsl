import valueParser from 'postcss-value-parser';
import { BreakpointMap, resolveResponsiveValue, validateBreakpoints, validateResponsiveExpression } from './language';
import { buildVarName, buildNamespacedVarName, NameRegistry } from './naming';

export function normalizeTokenKey(kind: string, input: string): string {
  let key = input.trim().replace(/^(['"])(.*)\1$/, '$2');
  if (!/^[\w.-]+$/.test(key)) throw new Error('UXD_TOKEN_KEY: Expected a token key.');
  if (kind === 'palette' || kind === 'color') key = key.replace(/\./g, '-');
  if (kind === 'palette' && !key.includes('-')) key += '-main';
  return key;
}

export function presetValueToCss(input: string, errorPrefix = 'UXD_PRESET', serializers: Partial<Record<string, (key: string) => string>> = {}): string {
  const parsed = valueParser(input);
  parsed.walk(node => {
    if (node.type !== 'function' || !['space', 'density', 'color', 'palette'].includes(node.value)) return;
    if (node.value === 'color' && /^(srgb|srgb-linear|display-p3|a98-rgb|prophoto-rgb|rec2020|xyz|xyz-d50|xyz-d65)\s/.test(valueParser.stringify(node.nodes).trim())) return;
    const args = valueParser.stringify(node.nodes).split(',').map(arg => arg.trim());
    const key = normalizeTokenKey(node.value, args[0]);
    const varName = node.value === 'color' || node.value === 'palette' ? buildNamespacedVarName(node.value, key) : buildVarName(node.value, key);
    let value = serializers[node.value]?.(key) || `var(${varName})`;
    if (args.length > 1) {
      const alpha = Number(args[1]);
      if (!['palette', 'color'].includes(node.value) || args.length !== 2 || !args[1] || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) throw new Error(`${errorPrefix}_ALPHA: Expected a number between 0 and 1.`);
      value = `color-mix(in srgb, ${value} ${alpha * 100}%, transparent)`;
    }
    Object.assign(node, { type: 'word', value });
    return false;
  });
  return parsed.toString();
}

export function mergePresetTokens(defaults: Record<string, string>, input: Record<string, string> | undefined, errorPrefix: string) {
  if (input !== undefined && (!input || typeof input !== 'object' || Array.isArray(input))) throw new Error(`${errorPrefix}_MAP: Expected an object.`);
  for (const [key, value] of Object.entries(input || {})) {
    if (!/^[\w-]+$/.test(key) || typeof value !== 'string' || !value.trim() || /[;{}]/.test(value)) throw new Error(`${errorPrefix}_VALUE: Invalid token ${key}.`);
    valueParser(value).walk(node => { if ((node as any).unclosed) throw new Error(`${errorPrefix}_VALUE: Unclosed expression for ${key}.`); });
  }
  return { ...defaults, ...input };
}

export function compilePresetRules(tokens: Record<string, Record<string, string>>, breakpoints: BreakpointMap, errorPrefix = 'UXD_PRESET') {
  const ordered = validateBreakpoints(breakpoints, `${errorPrefix}_BP`);
  const rules = ordered.map(([breakpoint, width], i) => ({ breakpoint, minWidth: i ? width : null as number | null, values: {} as Record<string, string> }));
  // MIG-08: two different (family, key) pairs — e.g. surface role
  // "contained-shadow" with no field suffix, and role "contained" field
  // "shadow" — can concatenate to the identical CSS variable name. Without
  // this, the second one to run would silently overwrite the first's
  // declaration; the registry turns that into a clear diagnostic instead.
  const names = new NameRegistry(errorPrefix);
  for (const family of Object.keys(tokens)) {
    for (const [key, expression] of Object.entries(tokens[family])) {
      validateResponsiveExpression(expression, breakpoints, `${errorPrefix}_BP`);
      const varName = names.claim(buildVarName(family, key), `${family}.${key}`);
      let previous: string | undefined;
      ordered.forEach(([bp], i) => {
        const value = presetValueToCss(resolveResponsiveValue(expression, bp, breakpoints), errorPrefix);
        if (!value && i === 0) throw new Error(`${errorPrefix}_BASE: ${family}.${key} needs a base value.`);
        if (value !== previous) rules[i].values[varName] = value;
        previous = value;
      });
    }
  }
  return rules.filter(rule => Object.keys(rule.values).length);
}

