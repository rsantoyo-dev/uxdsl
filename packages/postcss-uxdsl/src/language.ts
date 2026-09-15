/** Environment-independent semantics shared by build and runtime adapters. */
import valueParser from 'postcss-value-parser';
import { buildVarName } from './naming';

/** `space-` is a reserved legacy prefix; remove it once, never recursively. */
export function normalizeSpacingKey(key: string): string {
  return key.startsWith('space-') ? key.slice(6) : key;
}

/** Normalize before emission so aliases cannot silently overwrite each other. */
export function normalizeSpacingDefinitions<T>(spacing: Record<string, T>): Record<string, T> {
  const normalized: Record<string, T> = Object.create(null);
  const sources = new Map<string, string>();
  for (const [key, value] of Object.entries(spacing)) {
    const token = normalizeSpacingKey(key);
    if (!token || token.startsWith('space-')) {
      throw new Error(`UXD_SPACING_KEY: Invalid spacing key "${key}"; use an identifier with at most one space- prefix.`);
    }
    if (sources.has(token)) {
      throw new Error(`UXD_SPACING_COLLISION: spacing keys "${sources.get(token)}" and "${key}" both define ${buildVarName('space', token)}. Use only one spelling.`);
    }
    sources.set(token, key);
    normalized[token] = value;
  }
  return normalized;
}

export type BreakpointMap = Record<string, number>;
export const DEFAULT_BREAKPOINTS: BreakpointMap = Object.freeze({
  xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280,
});

export function validateBreakpoints(bps: BreakpointMap, prefix = 'UXD_BP_INVALID') {
  const ordered = Object.entries(bps).sort((a,b) => a[1]-b[1]);
  if (!ordered.length || ordered[0][1] !== 0 || ordered.some(([name,width]) => !/^[a-z][\w-]*$/i.test(name) || !Number.isFinite(width) || width < 0) || new Set(ordered.map(([,width]) => width)).size !== ordered.length) throw new Error(`${prefix}: Expected named, distinct non-negative widths and a zero-width base.`);
  return ordered;
}
const NATIVE_VALUE_FUNCTIONS = ['var', 'calc', 'min', 'max', 'clamp', 'space', 'density', 'color', 'palette', 'rgb', 'rgba', 'hsl', 'hsla', 'oklch', 'oklab', 'color-mix', 'light-dark', 'linear-gradient', 'radial-gradient', 'conic-gradient', 'repeating-linear-gradient', 'repeating-radial-gradient', 'repeating-conic-gradient', 'url', 'image-set', 'env', 'scale', 'scaleX', 'scaleY', 'translate', 'translateX', 'translateY', 'rotate', 'matrix'];
export function validateResponsiveExpression(expression: string, bps: BreakpointMap, prefix = 'UXD_VALUE') {
  if (typeof expression !== 'string' || !expression.trim() || /[;{}]/.test(expression)) throw new Error(`${prefix}: Expected a nonempty value.`);
  const parsed = valueParser(expression);
  parsed.walk(node => { if ((node as any).unclosed) throw new Error(`${prefix}: Unclosed expression.`); });
  for (const node of parsed.nodes) if (node.type === 'function' && !Object.prototype.hasOwnProperty.call(bps, node.value) && !NATIVE_VALUE_FUNCTIONS.includes(node.value)) throw new Error(`${prefix}: Unknown function or breakpoint ${node.value}.`);
}

// Density defaults stay inside the shipped 1–16 Spacing scale.
export const DEFAULT_DENSITIES: Record<number, string> = Object.freeze(
  { 0: '0', ...Object.fromEntries(Array.from({ length: 15 }, (_, i) => [i + 1,
    `xs(space(${i + 1})) md(space(${i + 2})) xl(space(${Math.min(i + 3, 16)}))`])) },
);
// Inventory of existing completion behavior, not a claim of complete grammar coverage.
export const LANGUAGE_COMPLETIONS = {
  directiveArguments: {
    'ds-surface': ['radius', 'shadow'],
    'ds-button': ['radius', 'shadow'],
    'ds-input': ['radius', 'shadow'],
  },
  directives: ['theme', 'ds-surface', 'ds-typo', 'ds-button', 'ds-input'],
  functions: ['palette', 'color', 'radius', 'rounded', 'border', 'density', 'shadow', 'elevation', 'space', ...Object.keys(DEFAULT_BREAKPOINTS)],
} as const;

/** Effective Density map is local to a compilation: defaults < legacy < JSON. */
export function getDensityTokens(theme: { densities?: Record<string, string> } = {}, legacy: Record<string, string> = {}): Record<string, string> {
  if (theme.densities !== undefined && (!theme.densities || typeof theme.densities !== 'object' || Array.isArray(theme.densities))) throw new Error('UXD_DENSITY_MAP: Expected an object.');
  const tokens = { ...DEFAULT_DENSITIES, ...legacy, ...theme.densities };
  for (const [key, value] of Object.entries(tokens)) if (!/^[\w-]+$/.test(key) || typeof value !== 'string' || !value.trim() || /[;{}]/.test(value)) throw new Error(`UXD_DENSITY_VALUE: Invalid ${key}.`);
  return tokens;
}

/** Editor/display adapter: the same parser reads configured responsive groups. */
export function responsiveEntries(input: string, bps: BreakpointMap): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const node of valueParser(input).nodes) if (node.type === 'function' && Object.prototype.hasOwnProperty.call(bps, node.value)) entries[node.value] = valueParser.stringify(node.nodes).trim();
  if (!Object.keys(entries).length) entries[Object.keys(bps).sort((a,b) => bps[a]-bps[b])[0]] = input.trim();
  return entries;
}

/** Preserve native CSS and token references; select responsive groups by width. */
export function resolveResponsiveValue(input: string, target: string, bps: BreakpointMap): string {
  const nodes = valueParser(input).nodes;
  const output: any[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type !== 'function' || !Object.prototype.hasOwnProperty.call(bps, node.value)) {
      output.push(node);
      continue;
    }
    const group = [node];
    let j = i + 1;
    let lastFunction = i;
    while (j < nodes.length) {
      const next = nodes[j];
      if (next.type === 'space') { j++; continue; }
      if (next.type !== 'function' || !Object.prototype.hasOwnProperty.call(bps, next.value) || group.some(entry => entry.value === next.value)) break;
      group.push(next);
      lastFunction = j;
      j++;
    }
    let best: typeof node | undefined;
    let bestPx = -1;
    for (const entry of group) {
      const px = bps[entry.value];
      if (px <= bps[target] && px > bestPx) { best = entry; bestPx = px; }
    }
    if (best) output.push({ type: 'word', value: resolveResponsiveValue(valueParser.stringify(best.nodes).trim(), target, bps) });
    i = lastFunction;
  }
  return valueParser.stringify(output).trim();
}

export function spacingValueToCss(input: string): string {
  const parsed = valueParser(input);
  parsed.walk(node => {
    if (node.type === 'function' && node.value === 'space') {
      const key = valueParser.stringify(node.nodes).trim().replace(/^(['"])(.*)\1$/, '$2');
      Object.assign(node, { type: 'word', value: `var(${buildVarName('space', key)})` });
      return false;
    }
  });
  return parsed.toString();
}

/** Inspection for a single responsive token; shares the production resolver. */
export function inspectResponsiveValue(input: string, width: number, bps: BreakpointMap) {
  const ordered = Object.entries(bps).sort((a, b) => a[1] - b[1]);
  const active = ordered.filter(([, px]) => px <= width).pop()?.[0];
  const present = new Set(valueParser(input).nodes.filter(node => node.type === 'function').map(node => node.value));
  const applied = ordered.filter(([name, px]) => px <= width && present.has(name)).pop()?.[0];
  return {
    active: active ?? null,
    applied: applied ?? null,
    value: active ? resolveResponsiveValue(input, active, bps) : '',
  };
}

export type DensityRule = { minWidth: number | null; breakpoint: string; values: Record<string, string> };

/** Both adapters share resolution, ordering and suppression of redundant rules. */
export function compileDensityRules(
  definitions: Record<string, string>,
  breakpoints: BreakpointMap = DEFAULT_BREAKPOINTS,
  rewrite: (value: string) => string = spacingValueToCss,
): DensityRule[] {
  const ordered = validateBreakpoints(breakpoints);
  const rules: DensityRule[] = ordered.map(([breakpoint, px], i) => ({ breakpoint, minWidth: i ? px : null, values: {} }));
  for (const [key, expression] of Object.entries(definitions)) {
    if (!/^[\w-]+$/.test(key)) throw new Error(`UXD_DENSITY_KEY: Invalid ${key}.`);
    validateResponsiveExpression(expression, breakpoints, 'UXD_DENSITY_VALUE');
    let previous: string | undefined;
    ordered.forEach(([bp], i) => {
      const value = rewrite(resolveResponsiveValue(expression, bp, breakpoints));
      if (i === 0 && !value) throw new Error(`UXD_DENSITY_BASE: ${key} needs a base value.`);
      if (i === 0 || value !== previous) rules[i].values[buildVarName('density', key)] = value;
      previous = value;
    });
  }
  return rules.filter(rule => Object.keys(rule.values).length);
}

export function generateDensityCss(
  definitions: Record<string, string>,
  breakpoints: BreakpointMap = DEFAULT_BREAKPOINTS,
  selector = ':root',
  strategy: 'media' | 'container' = 'media',
): string {
  return compileDensityRules(definitions, breakpoints).map(rule => {
    const body = `${selector} { ${Object.entries(rule.values).map(([key, value]) => `${key}: ${value};`).join(' ')} }`;
    return rule.minWidth === null ? body : `@${strategy} (min-width: ${rule.minWidth}px) { ${body} }`;
  }).join('\n');
}
