import valueParser from 'postcss-value-parser';
import { BreakpointMap, resolveResponsiveValue } from './language';

export function presetValueToCss(input: string, errorPrefix = 'UXD_PRESET'): string {
  const parsed = valueParser(input);
  parsed.walk(node => {
    if (node.type !== 'function' || !['space', 'density', 'color', 'palette'].includes(node.value)) return;
    const key = valueParser.stringify(node.nodes).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!/^[\w.-]+$/.test(key)) throw new Error(`${errorPrefix}_TOKEN: Expected a token key.`);
    const prefix = node.value === 'color' || node.value === 'palette' ? `ds__${node.value}__` : `${node.value}-`;
    Object.assign(node, { type: 'word', value: `var(--${prefix}${key.replace(/\./g, '-')})` });
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
  const ordered = Object.entries(breakpoints).sort((a, b) => a[1] - b[1]);
  if (!ordered.length || ordered[0][1] !== 0 || ordered.some(([, w]) => !Number.isFinite(w) || w < 0) || new Set(ordered.map(([, w]) => w)).size !== ordered.length) throw new Error(`${errorPrefix}_BP: Expected distinct non-negative widths and a zero-width base.`);
  const rules = ordered.map(([breakpoint, width], i) => ({ breakpoint, minWidth: i ? width : null as number | null, values: {} as Record<string, string> }));
  for (const family of Object.keys(tokens)) {
    for (const [key, expression] of Object.entries(tokens[family])) {
      // Unknown outer functions must not silently become invalid responsive CSS.
      for (const node of valueParser(expression).nodes) {
        if (node.type === 'function' && !(node.value in breakpoints) && !['var', 'calc', 'min', 'max', 'clamp', 'space', 'density', 'color', 'palette', 'rgb', 'rgba', 'hsl', 'hsla', 'oklch', 'oklab', 'color-mix', 'light-dark', 'linear-gradient', 'radial-gradient', 'conic-gradient', 'repeating-linear-gradient', 'repeating-radial-gradient', 'repeating-conic-gradient', 'url', 'image-set', 'env', 'scale', 'scaleX', 'scaleY', 'translate', 'translateX', 'translateY', 'rotate', 'matrix'].includes(node.value)) throw new Error(`${errorPrefix}_BP: Unknown function or breakpoint ${node.value}.`);
      }
      let previous: string | undefined;
      ordered.forEach(([bp], i) => {
        const value = presetValueToCss(resolveResponsiveValue(expression, bp, breakpoints), errorPrefix);
        if (!value && i === 0) throw new Error(`${errorPrefix}_BASE: ${family}.${key} needs a base value.`);
        if (value !== previous) rules[i].values[`--${family}-${key}`] = value;
        previous = value;
      });
    }
  }
  return rules.filter(rule => Object.keys(rule.values).length);
}

