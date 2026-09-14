import valueParser from 'postcss-value-parser';
import { BreakpointMap, DEFAULT_BREAKPOINTS, resolveResponsiveValue } from './language';

export const DEFAULT_RADII: Record<string, string> = Object.freeze({
  0: '0',
  1: 'xs(space(1)) lg(space(2))', 2: 'xs(space(2)) lg(space(3))',
  3: 'xs(space(3)) lg(space(4))', 4: 'xs(space(4)) lg(space(6))', 5: 'xs(space(6)) lg(space(8))',
});
export const DEFAULT_BORDERS: Record<string, string> = Object.freeze({
  1: 'xs(1px solid color(gray.300))', 2: 'xs(space(1) solid color(gray.300))',
  3: 'xs(space(2) solid color(gray.400))', 4: 'xs(space(3) solid color(gray.500))', 5: 'xs(space(4) solid color(gray.600))',
});
export const RADIUS_KEYWORDS: Record<string, string> = Object.freeze({ pill: '9999px', full: '9999px', circle: '50%' });
export interface EdgeTheme { borders?: Record<string, string>; radii?: Record<string, string>; breakpoints?: BreakpointMap }

export function edgeValueToCss(input: string): string {
  const parsed = valueParser(input);
  parsed.walk(node => {
    if (node.type !== 'function' || !['space', 'density', 'color', 'palette'].includes(node.value)) return;
    const key = valueParser.stringify(node.nodes).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!/^[\w.-]+$/.test(key)) throw new Error('UXD_EDGE_TOKEN: Expected a token key.');
    const prefix = node.value === 'color' || node.value === 'palette' ? `ds__${node.value}__` : `${node.value}-`;
    Object.assign(node, { type: 'word', value: `var(--${prefix}${key.replace(/\./g, '-')})` });
    return false;
  });
  return parsed.toString();
}

export function getEdgeTokens(theme: EdgeTheme = {}) {
  for (const family of ['borders', 'radii'] as const) {
    const map = theme[family];
    if (map !== undefined && (!map || typeof map !== 'object' || Array.isArray(map))) throw new Error(`UXD_EDGE_MAP: ${family} must be an object.`);
    for (const [key, value] of Object.entries(map || {})) {
      if (!/^[\w-]+$/.test(key) || typeof value !== 'string' || !value.trim() || /[;{}]/.test(value)) throw new Error(`UXD_EDGE_VALUE: Invalid ${family}.${key}.`);
    }
  }
  return { borders: { ...DEFAULT_BORDERS, ...theme.borders }, radii: { ...DEFAULT_RADII, ...theme.radii } };
}

export function compileEdgeRules(theme: EdgeTheme = {}, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }) {
  const ordered = Object.entries(breakpoints).sort((a, b) => a[1] - b[1]);
  if (!ordered.length || ordered[0][1] !== 0 || ordered.some(([, w]) => !Number.isFinite(w) || w < 0) || new Set(ordered.map(([, w]) => w)).size !== ordered.length) throw new Error('UXD_EDGE_BP: Expected distinct non-negative widths and a zero-width base.');
  const rules = ordered.map(([breakpoint, width], i) => ({ breakpoint, minWidth: i ? width : null as number | null, values: {} as Record<string, string> }));
  const tokens = getEdgeTokens(theme);
  for (const family of ['borders', 'radii'] as const) {
    for (const [key, expression] of Object.entries(tokens[family])) {
      // Unknown outer functions must not silently become invalid responsive CSS.
      for (const node of valueParser(expression).nodes) {
        if (node.type === 'function' && !(node.value in breakpoints) && !['var', 'calc', 'min', 'max', 'clamp', 'space', 'density', 'color', 'palette', 'rgb', 'rgba', 'hsl', 'hsla', 'oklch', 'oklab', 'color-mix', 'light-dark'].includes(node.value)) throw new Error(`UXD_EDGE_BP: Unknown function or breakpoint ${node.value}.`);
      }
      let previous: string | undefined;
      ordered.forEach(([bp], i) => {
        const value = edgeValueToCss(resolveResponsiveValue(expression, bp, breakpoints));
        if (!value && i === 0) throw new Error(`UXD_EDGE_BASE: ${family}.${key} needs a base value.`);
        if (value !== previous) rules[i].values[`--${family === 'borders' ? 'border' : 'radius'}-${key}`] = value;
        previous = value;
      });
    }
  }
  return rules.filter(rule => Object.keys(rule.values).length);
}

export function generateEdgeCss(theme: EdgeTheme = {}, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }, selector = ':root'): string {
  return compileEdgeRules(theme, breakpoints).map(rule => {
    const css = `${selector} { ${Object.entries(rule.values).map(([p, v]) => `${p}: ${v};`).join(' ')} }`;
    return rule.minWidth === null ? css : `@media (min-width: ${rule.minWidth}px) { ${css} }`;
  }).join('\n');
}

export function inspectEdgeTheme(theme: EdgeTheme, viewport: number) {
  if (!Number.isFinite(viewport) || viewport < 0) throw new Error('UXD_EDGE_VIEWPORT: Expected a non-negative width.');
  const values: Record<string, string> = {};
  for (const rule of compileEdgeRules(theme)) if (rule.minWidth === null || rule.minWidth <= viewport) Object.assign(values, rule.values);
  return values;
}
