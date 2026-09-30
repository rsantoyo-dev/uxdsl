/** Environment-independent semantics shared by build and runtime adapters. */
import valueParser from 'postcss-value-parser';
import { buildVarName } from './naming';
import { themeError } from './diagnostics';
import { BASE_THEME } from './base-theme';

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
// MIG-B6-29 (FEAT-008): derived from theme/base.json (via BASE_THEME), not a
// second, independently-maintained literal — see base-theme.ts for why this
// direction (engine imports data) never cycles back through the resolver.
export const DEFAULT_BREAKPOINTS: BreakpointMap = BASE_THEME.breakpoints as BreakpointMap;

export function validateBreakpoints(bps: BreakpointMap, prefix = 'UXD_BP_INVALID') {
  const ordered = Object.entries(bps).sort((a,b) => a[1]-b[1]);
  if (!ordered.length || ordered[0][1] !== 0 || ordered.some(([name,width]) => !/^[a-z][\w-]*$/i.test(name) || !Number.isFinite(width) || width < 0) || new Set(ordered.map(([,width]) => width)).size !== ordered.length) throw new Error(`${prefix}: Expected named, distinct non-negative widths and a zero-width base.`);
  return ordered;
}
// MIG-B6-14 (FEAT-008): every CSS/UXDSL function name a responsive-looking
// value can legitimately use at its top level, shared by validateResponsiveExpression
// (theme-level Density/Typography values) and index.ts's own UXD_BREAKPOINT_UNKNOWN
// check (arbitrary user CSS declarations) — one inventory, not two independently
// maintained lists that can drift apart. Not an exhaustive CSS grammar: functions
// nested inside another function's arguments are never top-level breakpoint
// candidates in the first place, so they don't need to be listed here.
//
// Known trap: `log` sits at edit distance 1 from the `lg` breakpoint name. This
// list is consulted before any edit-distance heuristic runs specifically so a
// real `log(...)` in a value next to `lg(...)` is never misread as a typo of it.
export const KNOWN_CSS_FUNCTIONS = [
  // UXDSL's own value functions. `tone` is valid in Button/Input theme values
  // only; it is listed so the grammar, not the breakpoint heuristic, reports
  // it elsewhere (UXD_TONE_CONTEXT, with the reason).
  'space', 'density', 'color', 'palette', 'radius', 'rounded', 'border', 'shadow', 'elevation', 'tone',
  // Math.
  'calc', 'min', 'max', 'clamp', 'round', 'mod', 'rem', 'abs', 'sign',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'pow', 'sqrt', 'hypot', 'log', 'exp',
  // Color.
  'rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color-mix', 'light-dark',
  // Everything else: references, gradients, grid/sizing, easing, transforms, filters, anchoring.
  'var', 'env', 'attr', 'url', 'image-set',
  'linear-gradient', 'radial-gradient', 'conic-gradient',
  'repeating-linear-gradient', 'repeating-radial-gradient', 'repeating-conic-gradient',
  'fit-content', 'repeat', 'minmax', 'cubic-bezier', 'steps',
  'translate', 'translateX', 'translateY', 'translateZ', 'translate3d',
  'scale', 'scaleX', 'scaleY', 'scaleZ', 'scale3d',
  'rotate', 'rotateX', 'rotateY', 'rotateZ', 'rotate3d',
  'skew', 'skewX', 'skewY', 'matrix', 'matrix3d', 'perspective',
  'blur', 'brightness', 'contrast', 'drop-shadow', 'grayscale', 'hue-rotate', 'invert', 'opacity', 'saturate', 'sepia',
  'anchor', 'anchor-size',
] as const;
export function validateResponsiveExpression(expression: string, bps: BreakpointMap, prefix = 'UXD_VALUE') {
  if (typeof expression !== 'string' || !expression.trim() || /[;{}]/.test(expression)) throw new Error(`${prefix}: Expected a nonempty value.`);
  const parsed = valueParser(expression);
  parsed.walk(node => { if ((node as any).unclosed) throw new Error(`${prefix}: Unclosed expression.`); });
  for (const node of parsed.nodes) if (node.type === 'function' && !Object.prototype.hasOwnProperty.call(bps, node.value) && !(KNOWN_CSS_FUNCTIONS as readonly string[]).includes(node.value)) throw new Error(`${prefix}: Unknown function or breakpoint ${node.value}.`);
}

// MIG-B6-29 (FEAT-008): derived from theme/base.json, not computed here —
// density defaults still stay inside the shipped 1-16 Spacing scale, that
// shape is just data now instead of a formula.
export const DEFAULT_DENSITIES: Record<string, string> = BASE_THEME.densities as Record<string, string>;
// Inventory of existing completion behavior, not a claim of complete grammar coverage.
// `directiveArguments` lists each directive's override-argument function
// names (`radius(...)`/`shadow(...)`, nested inside e.g. `@ds-button(...)`)
// — distinct from the role/tone/size argument values themselves, which
// depend on the effective theme and are composed on top of this in
// scripts/generate-language-artifacts.js (see getToneFamilies below),
// not hand-listed here.
export const LANGUAGE_COMPLETIONS = {
  directiveArguments: {
    'ds-surface': ['radius', 'shadow'],
    'ds-button': ['radius', 'shadow'],
    'ds-input': ['radius', 'shadow'],
  },
  directives: ['theme', 'ds-surface', 'ds-typo', 'ds-button', 'ds-input'],
  functions: ['palette', 'color', 'radius', 'rounded', 'border', 'density', 'shadow', 'elevation', 'space', ...Object.keys(DEFAULT_BREAKPOINTS)],
} as const;

// MIG-B6-26 (FEAT-008): the exact tone predicate control-engine.ts's own
// button/input tone generation uses (moved here, not duplicated, and
// re-exported for it to import back) — a tone must be a full color family
// (main/dark/contrast), not a semantic overlay group like text/divider/
// action that only defines the sub-keys it actually needs. Lives in
// language.ts (not control-engine.ts/surfaces.ts) so the vscode
// extension's completion generator can derive its own tone list from
// DEFAULT_THEME.palette without importing anything that would create a
// cycle back through surfaces.ts/control-engine.ts, both of which already
// import from this module.
export function getToneFamilies(palette: Record<string, unknown> = {}): string[] {
  return Object.keys(palette).filter((key) => {
    const family = (palette as Record<string, unknown>)[key];
    return (
      /^[a-z][a-z0-9-]*$/.test(key) &&
      !!family && typeof family === 'object' && !Array.isArray(family) &&
      ['main', 'dark', 'contrast'].every((variant) => variant in (family as Record<string, unknown>))
    );
  });
}

// MIG-B6-13 (FEAT-008) code-review follow-up: located with `themeError` the
// same way typography.ts already is — `{ densities: { x: '' } }` previously
// threw `UXD_DENSITY_VALUE: Invalid x.` with no `.keyPath`, leaving no way
// to tell it came from `densities.x` versus a merged default/legacy key.
/** Effective Density map is local to a compilation: defaults < legacy < JSON. */
export function getDensityTokens(theme: { densities?: Record<string, string> } = {}, legacy: Record<string, string> = {}): Record<string, string> {
  if (theme.densities !== undefined && (!theme.densities || typeof theme.densities !== 'object' || Array.isArray(theme.densities))) throw themeError('UXD_DENSITY_MAP', 'Expected an object', 'densities');
  const tokens = { ...DEFAULT_DENSITIES, ...legacy, ...theme.densities };
  for (const [key, value] of Object.entries(tokens)) if (!/^[\w-]+$/.test(key) || typeof value !== 'string' || !value.trim() || /[;{}]/.test(value)) throw themeError('UXD_DENSITY_VALUE', `Invalid ${key}`, `densities.${key}`);
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

// --- The value grammar (stability phase 1, audit finding T1) ---------------
//
// One grammar for every theme value, in every family, on both CSS paths: a
// literal CSS value; a token function — `space(k)`, `density(k)`,
// `color(family.shade[, alpha])`, `palette(family[.variant][, alpha])`,
// `radius(k | pill | full | circle)`, `border(k)`, `shadow(k)` (and the
// aliases `rounded()`/`elevation()`); a responsive expression over the
// theme's breakpoints (`xs(…) md(…)`, resolved by resolveResponsiveValue
// before this runs); and `var()` as the escape hatch, passed through. The
// engines (foundations, typography, densities, presets, surfaces, controls)
// all serialize through `tokenValueToCss`, so `generateThemeCss` and the
// PostCSS plugin emit the identical variable for `radii.x: 'radius(2)'` or
// `palette.brand.main: 'color(gray.300)'`. Before this, only presets resolved
// `space/density/color/palette` and the plugin's final pass over *every*
// declaration papered over the rest at build time only.

/** `radius(pill)`/`radius(full)` compile to `9999px`, `radius(circle)` to `50%`. */
export const RADIUS_KEYWORDS: Record<string, string> = Object.freeze({ pill: '9999px', full: '9999px', circle: '50%' });

/** The token functions the grammar rewrites, alias → family. */
export const TOKEN_FUNCTIONS: Readonly<Record<string, string>> = Object.freeze({
  space: 'space', density: 'density', color: 'color', palette: 'palette',
  radius: 'radius', rounded: 'radius', border: 'border', shadow: 'shadow', elevation: 'shadow',
});

export function normalizeTokenKey(kind: string, input: string): string {
  let key = input.trim().replace(/^(['"])(.*)\1$/, '$2');
  if (!/^[\w.-]+$/.test(key)) throw new Error('UXD_TOKEN_KEY: Expected a token key.');
  if (kind === 'palette' || kind === 'color') key = key.replace(/\./g, '-');
  if (kind === 'palette' && !key.includes('-')) key += '-main';
  return key;
}

/** Per-family overrides of the emitted reference, keyed by family. */
export type TokenSerializers = Partial<Record<string, (key: string) => string>>;

/**
 * Rewrites every token function in `input` to its `var(--uxdsl__<family>__<key>)`
 * reference (or a radius keyword's literal), leaving everything else — native
 * CSS, `var()`, a native `color(display-p3 …)` — untouched. Does not check
 * that the token exists: the reference-integrity pass over the emitted
 * stylesheet does, on both paths, and the plugin's own author-side pass adds
 * "did you mean" hints before delegating here.
 */
export function tokenValueToCss(input: string, serializers: TokenSerializers = {}): string {
  const parsed = valueParser(input);
  parsed.walk(node => {
    // `tone()` belongs to Button/Input theme values only; control-engine.ts
    // substitutes it before any value reaches this grammar, so one still
    // here is in a family (or an author's stylesheet) that has no tone.
    if (node.type === 'function' && node.value === 'tone') throw new Error('UXD_TONE_CONTEXT: tone() is only valid inside a theme\'s buttons/inputs values, where a requested tone can supply it.');
    if (node.type !== 'function' || !Object.prototype.hasOwnProperty.call(TOKEN_FUNCTIONS, node.value)) return;
    const kind = TOKEN_FUNCTIONS[node.value];
    const args = valueParser.stringify(node.nodes).split(',').map(arg => arg.trim());
    // MIG-B6-14 (FEAT-008): `color()` is the one UXDSL token function that
    // collides with a real native CSS function of the same name (relative
    // color syntax `color(from red srgb r g b / 0.5)`, an explicit color
    // space `color(display-p3 1 0 0)`). A token's own key always matches
    // `normalizeTokenKey`'s shape (`/^[\w.-]+$/`, no spaces); any native
    // form's first "argument" (there's no comma to split on) contains a
    // space or slash and never does. This replaces a fixed, incomplete list
    // of known color-space keywords — CSS keeps adding spaces (rec2100-pq,
    // etc.) that list would need to track forever — with a shape check that
    // needs no such list at all.
    if (kind === 'color' && !/^[\w.-]+$/.test(args[0].replace(/^(['"])(.*)\1$/, '$2'))) return;
    const key = normalizeTokenKey(kind, args[0]);
    let value = kind === 'radius' && RADIUS_KEYWORDS[key] ? RADIUS_KEYWORDS[key] : serializers[kind]?.(key) || `var(${buildVarName(kind, key)})`;
    // `border(k[, color][, style])`: the configured preset wins and the
    // optional arguments are ignored (documented); every other function takes
    // one key, plus an alpha for `palette`/`color` only.
    if (args.length > 1 && kind !== 'border') {
      const alpha = Number(args[1]);
      if (!['palette', 'color'].includes(kind) || args.length !== 2 || !args[1] || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) throw new Error('UXD_TOKEN_ALPHA: Expected a number between 0 and 1.');
      value = `color-mix(in srgb, ${value} ${alpha * 100}%, transparent)`;
    }
    Object.assign(node, { type: 'word', value });
    return false;
  });
  return parsed.toString();
}

/** @deprecated The grammar is one function now; this is `tokenValueToCss`. */
export const spacingValueToCss = (input: string): string => tokenValueToCss(input);

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
  rewrite: (value: string) => string = tokenValueToCss,
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
