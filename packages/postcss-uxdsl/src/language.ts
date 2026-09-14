/** Environment-independent semantics shared by build and runtime adapters. */
import valueParser from 'postcss-value-parser';

export type BreakpointMap = Record<string, number>;
export const DEFAULT_BREAKPOINTS: BreakpointMap = Object.freeze({
  xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280,
});

// Compatibility defaults; density-15 still references space-17 as before.
// Reconciliation of that existing dangling reference is tracked in ENG-00.
export const DEFAULT_DENSITIES: Record<number, string> = Object.freeze(
  Object.fromEntries(Array.from({ length: 15 }, (_, i) => [i + 1,
    `xs(space(${i + 1})) md(space(${i + 2})) xl(space(${i + 3}))`])),
);
// Inventory of existing completion behavior, not a claim of complete grammar coverage.
export const LANGUAGE_COMPLETIONS = {
  directives: ['theme', 'ds-surface', 'ds-typo', 'ds-button'],
  functions: ['palette', 'radius', 'density', 'shadow', 'space', ...Object.keys(DEFAULT_BREAKPOINTS)],
} as const;

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
    while (j < nodes.length) {
      const next = nodes[j];
      if (next.type === 'space') { j++; continue; }
      if (next.type !== 'function' || !Object.prototype.hasOwnProperty.call(bps, next.value)) break;
      group.push(next);
      j++;
    }
    let best: typeof node | undefined;
    let bestPx = -1;
    for (const entry of group) {
      const px = bps[entry.value];
      if (px <= bps[target] && px > bestPx) { best = entry; bestPx = px; }
    }
    if (best) output.push({ type: 'word', value: resolveResponsiveValue(valueParser.stringify(best.nodes).trim(), target, bps) });
    i = j - 1;
  }
  return valueParser.stringify(output).trim();
}

export function spacingValueToCss(input: string): string {
  const parsed = valueParser(input);
  parsed.walk(node => {
    if (node.type === 'function' && node.value === 'space') {
      const key = valueParser.stringify(node.nodes).trim().replace(/^(['"])(.*)\1$/, '$2');
      Object.assign(node, { type: 'word', value: `var(--space-${key})` });
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
  const ordered = Object.entries(breakpoints).sort((a, b) => a[1] - b[1]);
  if (!ordered.length || ordered.some(([, px]) => !Number.isFinite(px) || px < 0)) {
    throw new Error('UXD_BP_INVALID: Breakpoints must contain finite non-negative widths.');
  }
  const rules: DensityRule[] = ordered.map(([breakpoint, px], i) => ({ breakpoint, minWidth: i ? px : null, values: {} }));
  for (const [key, expression] of Object.entries(definitions)) {
    let previous: string | undefined;
    ordered.forEach(([bp], i) => {
      const value = rewrite(resolveResponsiveValue(expression, bp, breakpoints));
      if (i === 0 || value !== previous) rules[i].values[`--density-${key}`] = value;
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
