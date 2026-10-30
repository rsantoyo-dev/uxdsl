/** Environment-independent semantics shared by build and runtime adapters. */
import valueParser from 'postcss-value-parser';
import { buildVarName } from './naming';
import { editDistance, themeError } from './diagnostics';
import { BASE_THEME } from './base-theme';
import { responsiveBlocks, serializeBlocks } from './css-blocks';

export type BreakpointMap = Record<string, number>;
// Derived from theme/base.json (via BASE_THEME), not a
// second, independently-maintained literal — see base-theme.ts for why this
// direction (engine imports data) never cycles back through the resolver.
export const DEFAULT_BREAKPOINTS: BreakpointMap = BASE_THEME.breakpoints as BreakpointMap;

export function validateBreakpoints(bps: BreakpointMap, prefix = 'UXD_BP_INVALID') {
  const ordered = Object.entries(bps).sort((a,b) => a[1]-b[1]);
  if (!ordered.length || ordered[0][1] !== 0 || ordered.some(([name,width]) => !/^[a-z][\w-]*$/i.test(name) || !Number.isFinite(width) || width < 0) || new Set(ordered.map(([,width]) => width)).size !== ordered.length) throw new Error(`${prefix}: Expected named, distinct non-negative widths and a zero-width base.`);
  return ordered;
}
// Every CSS/UXDSL function name a value can legitimately use, shared by
// validateResponsiveExpression (theme values), the plugin's UXD_BREAKPOINT_UNKNOWN
// check (author declarations) and unknownFunctionMessage (both) — one
// inventory, not three lists that drift apart. A name here is never flagged,
// whatever UXDSL name it resembles; a name missing from it is flagged only
// when it is a near-miss of a UXDSL name, so the list need not be exhaustive
// for a far name (`foo()`) to pass through. It follows MDN's list of CSS
// functions (vendor-prefixed names are recognized by their `-` prefix instead).
//
// Known traps: `log` is one edit from the `lg` breakpoint, `shape` two from
// `space`. Being listed is what keeps a real `log(…)` or `shape(…)` from
// reading as a typo.
export const KNOWN_CSS_FUNCTIONS = [
  // UXDSL's own value functions. `tone` is valid in Button/Input theme values
  // only; it is listed so the grammar, not the breakpoint heuristic, reports
  // it elsewhere (UXD_TONE_CONTEXT, with the reason).
  'space', 'density', 'color', 'palette', 'radius', 'border', 'shadow', 'tone',
  // Math.
  'calc', 'calc-size', 'min', 'max', 'clamp', 'round', 'mod', 'rem', 'abs', 'sign',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'pow', 'sqrt', 'hypot', 'log', 'exp',
  'random', 'progress', 'media-progress', 'container-progress', 'sibling-index', 'sibling-count',
  // Color.
  'rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color-mix', 'light-dark', 'contrast-color', 'device-cmyk', 'palette-mix',
  // References and conditionals.
  'var', 'env', 'attr', 'url', 'src', 'if', 'image-set',
  // Images.
  'image', 'cross-fade', 'element', 'paint',
  'linear-gradient', 'radial-gradient', 'conic-gradient',
  'repeating-linear-gradient', 'repeating-radial-gradient', 'repeating-conic-gradient',
  // Counters and generated content.
  'counter', 'counters', 'symbols', 'string', 'content', 'leader', 'running', 'target-counter', 'target-counters', 'target-text',
  // Shapes.
  'circle', 'ellipse', 'inset', 'rect', 'xywh', 'polygon', 'path', 'shape', 'ray',
  // Grid and sizing; easing; animation timelines.
  'fit-content', 'repeat', 'minmax', 'linear', 'cubic-bezier', 'steps', 'scroll', 'view',
  // Transforms.
  'translate', 'translateX', 'translateY', 'translateZ', 'translate3d',
  'scale', 'scaleX', 'scaleY', 'scaleZ', 'scale3d',
  'rotate', 'rotateX', 'rotateY', 'rotateZ', 'rotate3d',
  'skew', 'skewX', 'skewY', 'matrix', 'matrix3d', 'perspective',
  // Filters.
  'blur', 'brightness', 'contrast', 'drop-shadow', 'grayscale', 'hue-rotate', 'invert', 'opacity', 'saturate', 'sepia',
  // Fonts (`src` descriptors and `font-variant-alternates`); anchoring; at-rule preludes.
  'format', 'local', 'tech', 'stylistic', 'styleset', 'character-variant', 'swash', 'ornaments', 'annotation',
  'anchor', 'anchor-size',
  'supports', 'selector', 'layer', 'font-tech', 'font-format',
] as const;
/** Function names are case-insensitive: `MD(…)` names the `md` breakpoint. */
const isBreakpoint = (bps: BreakpointMap, name: string) => Object.prototype.hasOwnProperty.call(bps, name.toLowerCase());
const KNOWN_FUNCTION_NAMES = new Set((KNOWN_CSS_FUNCTIONS as readonly string[]).map((name) => name.toLowerCase()));
export function validateResponsiveExpression(expression: string, bps: BreakpointMap, prefix = 'UXD_VALUE') {
  if (typeof expression !== 'string' || !expression.trim() || /[;{}]/.test(expression)) throw new Error(`${prefix}: Expected a nonempty value.`);
  const parsed = valueParser(expression);
  parsed.walk(node => { if ((node as any).unclosed) throw new Error(`${prefix}: Unclosed expression.`); });
  for (const node of parsed.nodes) {
    if (node.type !== 'function' || isBreakpoint(bps, node.value) || KNOWN_FUNCTION_NAMES.has(node.value.toLowerCase())) continue;
    // A removed spelling names its replacement, and a near-miss the name
    // meant, instead of reading as an unknown function.
    const removed = removedSyntaxMessage(node.value, valueParser.stringify(node.nodes));
    throw new Error(removed || unknownFunctionMessage(node.value, { breakpoints: bps }) || `${prefix}: Unknown function or breakpoint ${node.value}.`);
  }
}

// Derived from theme/base.json, not computed here —
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
  directives: ['ds-surface', 'ds-typo', 'ds-button', 'ds-input'],
  functions: ['palette', 'color', 'radius', 'border', 'density', 'shadow', 'space', ...Object.keys(DEFAULT_BREAKPOINTS)],
} as const;

// The exact tone predicate control-engine.ts's own
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

// Located with `themeError` the
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
  for (const node of valueParser(input).nodes) if (node.type === 'function' && isBreakpoint(bps, node.value)) entries[node.value.toLowerCase()] = valueParser.stringify(node.nodes).trim();
  if (!Object.keys(entries).length) entries[Object.keys(bps).sort((a,b) => bps[a]-bps[b])[0]] = input.trim();
  return entries;
}

/** Preserve native CSS and token references; select responsive groups by width. */
export function resolveResponsiveValue(input: string, target: string, bps: BreakpointMap): string {
  const nodes = valueParser(input).nodes;
  const output: any[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type !== 'function' || !isBreakpoint(bps, node.value)) {
      output.push(node);
      continue;
    }
    const group = [node];
    let j = i + 1;
    let lastFunction = i;
    while (j < nodes.length) {
      const next = nodes[j];
      if (next.type === 'space') { j++; continue; }
      if (next.type !== 'function' || !isBreakpoint(bps, next.value) || group.some(entry => entry.value.toLowerCase() === next.value.toLowerCase())) break;
      group.push(next);
      lastFunction = j;
      j++;
    }
    let best: typeof node | undefined;
    let bestPx = -1;
    for (const entry of group) {
      const px = bps[entry.value.toLowerCase()];
      if (px <= bps[target] && px > bestPx) { best = entry; bestPx = px; }
    }
    if (best) output.push({ type: 'word', value: resolveResponsiveValue(valueParser.stringify(best.nodes).trim(), target, bps) });
    i = lastFunction;
  }
  return valueParser.stringify(output).trim();
}

// --- The value grammar ------------------------------------------------------
//
// One grammar for every theme value, in every family, on both CSS paths, and
// for every author declaration: a literal CSS value; a token function —
// `space(k)`, `density(k)`, `color(family[.shade][, alpha])`,
// `palette(family[.variant][, alpha])`, `radius(k | pill | circle)`,
// `border(k)`, `shadow(k)`; a responsive expression over the theme's
// breakpoints (`xs(…) md(…)`, resolved by resolveResponsiveValue before this
// runs); and `var()` as the escape hatch, passed through. Function names are
// case-insensitive. Exactly one argument everywhere, plus an optional alpha on
// `palette()`/`color()` only; a token key is a bare word; `family.variant` is
// the only spelling of a Palette or Color entry. The engines (foundations,
// typography, densities, presets, surfaces, controls) all serialize through
// `tokenValueToCss`, so `generateThemeCss` and the PostCSS plugin emit the
// identical variable for `radii.x: 'radius(2)'` or `palette.brand.main:
// 'color(gray.300)'`.

/** `radius(pill)` compiles to `9999px`, `radius(circle)` to `50%`. */
export const RADIUS_KEYWORDS: Record<string, string> = Object.freeze({ pill: '9999px', circle: '50%' });

/** The token functions the grammar rewrites, name → family. One name per concept. */
export const TOKEN_FUNCTIONS: Readonly<Record<string, string>> = Object.freeze({
  space: 'space', density: 'density', color: 'color', palette: 'palette',
  radius: 'radius', border: 'border', shadow: 'shadow',
});

/** The diagnostic-code family of each token function (`UXD_SPACE_ARGUMENT`, …). */
export const TOKEN_FUNCTION_CODES: Readonly<Record<string, string>> = Object.freeze({
  space: 'UXD_SPACE', density: 'UXD_DENSITY', color: 'UXD_COLOR', palette: 'UXD_PALETTE',
  radius: 'UXD_EDGE', border: 'UXD_EDGE', shadow: 'UXD_SHADOW',
});

/**
 * Spellings the language no longer has. Each fails as `UXD_SYNTAX_REMOVED`,
 * naming what to write instead, wherever the one value grammar runs — an
 * author's declaration or a theme value — so none of them reaches CSS as an
 * unknown function a browser silently discards.
 */
const REMOVED_FUNCTIONS: Readonly<Record<string, (args: string) => string>> = Object.freeze({
  rounded: (args: string) => `rounded() was removed; use radius(${args}).`,
  elevation: (args: string) => `elevation() was removed; use shadow(${args}).`,
  densities: () => 'densities() was removed; define the progression once as a Density token in the theme (densities: { "k": "xs(space(1)) md(space(2))" }) and use density(k).',
});

/** The message for a removed function call, or `undefined` for any other name. */
export function removedSyntaxMessage(name: string, args: string): string | undefined {
  const lower = name.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(REMOVED_FUNCTIONS, lower)) return `UXD_SYNTAX_REMOVED: ${REMOVED_FUNCTIONS[lower](args.trim())}`;
  return undefined;
}

/** `radius(full)` was an alias of `radius(pill)`. A theme may still define its
 * own `radii.full`; without one, the reference fails with this message. */
export const REMOVED_RADIUS_FULL = 'UXD_SYNTAX_REMOVED: radius(full) was removed; use radius(pill).';

/**
 * Spellings that are not a typo of one letter but are what people write for a
 * token function — the family's name, a plural, another language's spelling.
 * Each fails as `UXD_FUNCTION_UNKNOWN` naming the function meant, like a
 * one-letter typo does through the distance rule below; a removed spelling
 * (`REMOVED_FUNCTIONS`) names its replacement instead and is consulted first.
 */
const NEAR_MISS_FUNCTIONS: Readonly<Record<string, string>> = Object.freeze({
  spacing: 'space', spaces: 'space',
  colour: 'color', colours: 'color', colors: 'color',
  palete: 'palette', pallete: 'palette', pallet: 'palette', pallette: 'palette', palettes: 'palette',
  radii: 'radius', radiuses: 'radius',
  borders: 'border',
  shadows: 'shadow',
});

export interface UnknownFunctionOptions {
  /** The theme's own breakpoints; the effective map is these over the defaults, as every compilation builds it. */
  breakpoints?: BreakpointMap;
  /** The name sits at the top level of an author's declaration value, where the breakpoint check runs after the grammar. */
  topLevel?: boolean;
}

/**
 * The `UXD_FUNCTION_UNKNOWN` message for a function name that is a near-miss
 * of a UXDSL name — a token function, `tone`, or a breakpoint of the effective
 * theme — or `undefined` for a name the grammar leaves alone: a known CSS
 * function, a breakpoint, a vendor-prefixed function (`-webkit-…`), or a name
 * too far from any UXDSL name (CSS keeps adding functions; `foo()` passes
 * through). The explicit table comes first; then the closest UXDSL name within
 * one edit for names of up to five characters, two edits for longer names, so
 * a short real function such as `shape()` is never two substitutions from
 * `space()`. Names are case-insensitive. At the top level of an author's
 * declaration, a name one edit from a breakpoint is left to the breakpoint
 * check (`UXD_BREAKPOINT_UNKNOWN`), which lists the configured names.
 */
export function unknownFunctionMessage(name: string, options: UnknownFunctionOptions = {}): string | undefined {
  const lower = name.toLowerCase();
  const bps: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...options.breakpoints };
  if (lower.startsWith('-') || KNOWN_FUNCTION_NAMES.has(lower) || isBreakpoint(bps, lower)) return undefined;
  const message = (suggestion: string) => `UXD_FUNCTION_UNKNOWN: ${name}() is not a function CSS or UXDSL knows; did you mean ${suggestion}()?`;
  if (Object.prototype.hasOwnProperty.call(NEAR_MISS_FUNCTIONS, lower)) return message(NEAR_MISS_FUNCTIONS[lower]);
  const breakpointNames = Object.keys(bps).map((bp) => bp.toLowerCase());
  if (options.topLevel && breakpointNames.some((bp) => editDistance(lower, bp) === 1)) return undefined;
  let closest: string | undefined;
  let best = (lower.length <= 5 ? 1 : 2) + 1;
  for (const candidate of [...Object.keys(TOKEN_FUNCTIONS), 'tone', ...breakpointNames]) {
    const distance = editDistance(lower, candidate);
    if (distance < best) { best = distance; closest = candidate; }
  }
  return closest === undefined ? undefined : message(closest);
}

/** What the grammar may consult to tell `palette(text-primary)` (a family
 * written with its dash) from the removed `palette(primary-main)` spelling:
 * the effective theme's own families. Optional — without it, no dash is split.
 * `breakpoints` names the theme's own breakpoints, so a custom one is never
 * read as a near-miss of a UXDSL function. An effective theme object is a
 * valid context: the three keys are the theme's own. */
export interface TokenContext { palette?: Record<string, unknown>; colors?: Record<string, unknown>; breakpoints?: BreakpointMap }

/** The parsed arguments of one token function call. */
export interface TokenReference {
  kind: string;
  /** The key as the variable name uses it: `1`, `primary-main`, `gray-300`, `pill`. */
  key: string;
  /** The argument as the author wrote it (lowercased): `primary`, `primary.main`. */
  written: string;
  /** Palette/Color: the family and the variant/shade (`main` when omitted on palette; empty for a standalone color). */
  family?: string;
  variant?: string;
  alpha?: number;
}

const BARE_KEY = /^[\w-]+$/;
const DOTTED_KEY = /^[\w-]+(\.[\w-]+)?$/;

/** The top-level, comma-separated arguments of a function node, as written. */
function argumentsOf(node: valueParser.FunctionNode): string[] {
  const groups: valueParser.Node[][] = [[]];
  for (const child of node.nodes) {
    if (child.type === 'div' && child.value === ',') groups.push([]);
    else groups[groups.length - 1].push(child);
  }
  const args = groups.map((group) => valueParser.stringify(group).trim());
  return args.length === 1 && args[0] === '' ? [] : args;
}

/** A dashed Palette/Color key that is really `family.variant` in the given theme: the dotted spelling, or null. */
function dottedSpelling(kind: string, key: string, context?: TokenContext): string | null {
  const map = (kind === 'palette' ? context?.palette : context?.colors) as Record<string, unknown> | undefined;
  if (!map || !key.includes('-') || Object.prototype.hasOwnProperty.call(map, key)) return null;
  const parts = key.split('-');
  for (let i = 1; i < parts.length; i++) {
    const family = parts.slice(0, i).join('-');
    const variant = parts.slice(i).join('-');
    const entry = map[family];
    if (entry && typeof entry === 'object' && Object.prototype.hasOwnProperty.call(entry, variant)) return `${family}.${variant}`;
  }
  return null;
}

/**
 * Parses the arguments of `kind(…)`: exactly one bare token key, plus an
 * optional alpha for `palette`/`color`. Throws the family's `_ARGUMENT` code
 * for the wrong count, `UXD_TOKEN_KEY` for a key that is not a bare word,
 * `UXD_PALETTE_SYNTAX`/`UXD_COLOR_SYNTAX` for a dashed or malformed path, and
 * `UXD_TOKEN_ALPHA` for a bad alpha. Does not check that the token exists.
 */
export function parseTokenReference(kind: string, args: string[], context?: TokenContext): TokenReference {
  const code = TOKEN_FUNCTION_CODES[kind];
  const call = `${kind}(${args.join(', ')})`;
  const usage = kind === 'palette' ? 'palette(family[.variant][, alpha])' : kind === 'color' ? 'color(family[.shade][, alpha])' : kind === 'radius' ? 'radius(k | pill | circle)' : `${kind}(k)`;
  if (!args.length || !args[0]) throw new Error(`${code}_ARGUMENT: ${call} needs a token key: ${usage}.`);
  const takesAlpha = kind === 'palette' || kind === 'color';
  if (args.length > (takesAlpha ? 2 : 1)) {
    const hint = kind === 'border' ? `write border(${args[0]}) and set border-color/border-style as declarations after it` : `write ${kind}(${args[0]})`;
    throw new Error(`${code}_ARGUMENT: ${call} takes ${takesAlpha ? 'at most a token key and an alpha' : 'exactly one argument'}: ${usage}; ${hint}.`);
  }
  if (/^['"]/.test(args[0]) || /['"]$/.test(args[0])) throw new Error(`UXD_TOKEN_KEY: A token key is a bare word; write ${kind}(${args[0].replace(/^['"]|['"]$/g, '')}) without quotes.`);
  // Keys are lowercase in the theme (`validateTheme`), so the reference is too.
  const raw = args[0].toLowerCase();
  const reference: TokenReference = { kind, key: raw, written: raw };
  if (takesAlpha) {
    const syntax = kind === 'palette' ? 'UXD_PALETTE_SYNTAX' : 'UXD_COLOR_SYNTAX';
    if (!DOTTED_KEY.test(raw)) throw new Error(`${syntax}: ${call} is not a ${kind} reference; write ${kind}(family${kind === 'palette' ? '.variant' : '.shade'})${takesAlpha ? ', with an optional alpha' : ''}.`);
    const [family, variant] = raw.split('.');
    const dotted = variant === undefined ? dottedSpelling(kind, family, context) : null;
    if (dotted) throw new Error(`${syntax}: ${call} is not a dotted path; write ${kind}(${dotted}${args[1] !== undefined ? `, ${args[1]}` : ''}).`);
    reference.family = family;
    reference.variant = variant ?? (kind === 'palette' ? 'main' : '');
    reference.key = reference.variant ? `${family}-${reference.variant}` : family;
  } else if (!BARE_KEY.test(raw)) {
    const fractional = /^\d*\.\d+$/.test(raw) ? ' A key is a reference the theme defines, never a number to scale.' : '';
    throw new Error(`UXD_TOKEN_KEY: ${call} is not a token key: ${usage}.${fractional}`);
  }
  if (args.length === 2) {
    const alpha = Number(args[1]);
    if (!args[1] || !/^\d*\.?\d+$/.test(args[1]) || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) throw new Error(`UXD_TOKEN_ALPHA: ${call}: expected an alpha between 0 and 1, got "${args[1]}".`);
    reference.alpha = alpha;
  }
  return reference;
}

/** The CSS a parsed token reference compiles to. */
export function tokenReferenceToCss(reference: TokenReference): string {
  let value = reference.kind === 'radius' && RADIUS_KEYWORDS[reference.key] ? RADIUS_KEYWORDS[reference.key] : `var(${buildVarName(reference.kind, reference.key)})`;
  if (reference.alpha !== undefined) value = `color-mix(in srgb, ${value} ${reference.alpha * 100}%, transparent)`;
  return value;
}

/**
 * Rewrites every token function in `input` to its `var(--uxdsl__<family>__<key>)`
 * reference (or a radius keyword's literal), leaving everything else — native
 * CSS, `var()`, a native `color(display-p3 …)` — untouched. Does not check
 * that the token exists: the reference-integrity pass over the emitted
 * stylesheet does, on both paths, and the plugin's own author-side pass
 * validates every reference against the effective theme (with "did you mean")
 * before delegating here. `context` lets the dashed-path error name the dotted
 * spelling a family actually has, and its `breakpoints` keep a custom
 * breakpoint from reading as a near-miss. A function that is none of the
 * above but is spelled close to a UXDSL name (`spacing()`, `palete()`) is
 * `UXD_FUNCTION_UNKNOWN` here, so a theme value fails like a declaration.
 */
export function tokenValueToCss(input: string, context?: TokenContext): string {
  const parsed = valueParser(input);
  parsed.walk(node => {
    if (node.type !== 'function') return;
    const name = node.value.toLowerCase();
    // `tone()` belongs to Button/Input theme values only; control-engine.ts
    // substitutes it before any value reaches this grammar, so one still
    // here is in a family (or an author's stylesheet) that has no tone.
    if (name === 'tone') throw new Error('UXD_TONE_CONTEXT: tone() is only valid inside a theme\'s buttons/inputs values, where a requested tone can supply it.');
    const removed = removedSyntaxMessage(name, valueParser.stringify(node.nodes));
    if (removed) throw new Error(removed);
    if (!Object.prototype.hasOwnProperty.call(TOKEN_FUNCTIONS, name)) {
      const unknown = unknownFunctionMessage(node.value, { breakpoints: context?.breakpoints });
      if (unknown) throw new Error(unknown);
      return;
    }
    const kind = TOKEN_FUNCTIONS[name];
    const args = argumentsOf(node);
    // `color()` is the one UXDSL token function that collides with a native
    // CSS function of the same name (relative color syntax `color(from red
    // srgb r g b / 0.5)`, an explicit color space `color(display-p3 1 0 0)`).
    // A token's own argument is one bare word; any native form's first
    // "argument" contains a space or a slash and never is.
    if (kind === 'color' && args.length && !/^[\w.-]+$/.test(args[0])) return;
    Object.assign(node, { type: 'word', value: tokenReferenceToCss(parseTokenReference(kind, args, context)) });
    return false;
  });
  return parsed.toString();
}

/** @deprecated The grammar is one function now; this is `tokenValueToCss`. */
export const spacingValueToCss = (input: string): string => tokenValueToCss(input);


/** What an editor or the compiler needs to know about the responsive groups of one value. */
export interface ResponsiveAnalysis {
  /** Top-level groups of adjacent breakpoint functions, in order, each with its source text. */
  groups: Array<{ names: string[]; text: string; hasBase: boolean; empty: string[]; important: boolean }>;
  /** The value is exactly one group and nothing else. */
  standalone: boolean;
  /** A breakpoint function nested inside another function (`calc(… xs(…))`, `xs(md(…))`), or null:
   * the breakpoint, the enclosing function, the breakpoint names of that inner group, and the
   * enclosing function's arguments as written. */
  nested: { name: string; parent: string; names: string[]; inner: string } | null;
}

/**
 * Describes the responsive structure of a value without resolving it: the
 * compiler turns a nested breakpoint, an empty argument, `!important` inside a
 * group or a group without a base next to other content into located errors
 * from this; an editor can show the same facts.
 */
export function analyzeResponsiveValue(input: string, bps: BreakpointMap): ResponsiveAnalysis {
  const nodes = valueParser(input).nodes;
  const base = Object.keys(bps).sort((a, b) => bps[a] - bps[b])[0];
  let nested: ResponsiveAnalysis['nested'] = null;
  const findNested = (node: valueParser.Node, parent: valueParser.FunctionNode | null) => {
    if (node.type !== 'function') return;
    if (parent && isBreakpoint(bps, node.value) && !nested) {
      const names = parent.nodes.filter((sibling) => sibling.type === 'function' && isBreakpoint(bps, sibling.value)).map((sibling) => sibling.value.toLowerCase());
      nested = { name: node.value.toLowerCase(), parent: parent.value.toLowerCase(), names: names.filter((entry, index) => names.indexOf(entry) === index), inner: valueParser.stringify(parent.nodes) };
    }
    for (const child of node.nodes) findNested(child, node);
  };
  for (const node of nodes) findNested(node, null);
  const groups: ResponsiveAnalysis['groups'] = [];
  let other = false;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === 'space' || node.type === 'comment') continue;
    if (node.type !== 'function' || !isBreakpoint(bps, node.value)) { other = true; continue; }
    const group: ResponsiveAnalysis['groups'][number] = { names: [], text: '', hasBase: false, empty: [], important: false };
    let j = i;
    let last = i;
    while (j < nodes.length) {
      const next = nodes[j];
      if (next.type === 'space' || next.type === 'comment') { j++; continue; }
      if (next.type !== 'function' || !isBreakpoint(bps, next.value) || group.names.includes(next.value.toLowerCase())) break;
      const name = next.value.toLowerCase();
      group.names.push(name);
      if (name === base) group.hasBase = true;
      if (!next.nodes.some((child) => child.type !== 'space' && child.type !== 'comment')) group.empty.push(name);
      if (next.nodes.some((child) => child.type === 'word' && child.value.toLowerCase() === '!important')) group.important = true;
      last = j;
      j++;
    }
    group.text = valueParser.stringify(nodes.slice(i, last + 1));
    groups.push(group);
    i = last;
  }
  return { groups, standalone: groups.length === 1 && !other, nested };
}

/** Inspection for a single responsive token; shares the production resolver. */
export function inspectResponsiveValue(input: string, width: number, bps: BreakpointMap) {
  const ordered = Object.entries(bps).sort((a, b) => a[1] - b[1]);
  const active = ordered.filter(([, px]) => px <= width).pop()?.[0];
  const present = new Set(valueParser(input).nodes.filter(node => node.type === 'function').map(node => node.value.toLowerCase()));
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
  rewrite: (value: string) => string = tokenValueToCss,
): string {
  return serializeBlocks(responsiveBlocks(compileDensityRules(definitions, breakpoints, rewrite), selector, strategy));
}
