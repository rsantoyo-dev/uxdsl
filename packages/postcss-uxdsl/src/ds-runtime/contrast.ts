import postcss from 'postcss';
import { DEFAULT_BREAKPOINTS, BreakpointMap, getToneFamilies } from '../language';
import { generateFoundationCss } from '../foundations';
import { inspectEdgeTheme } from '../edges';
import { inspectShadowTheme } from '../shadows';
import { inspectSurfaceTheme, surfaceDeclarations, getSurfaceTokens } from '../surfaces';
import { getButtonTokens, buttonDeclarations, inspectButtonTheme } from '../buttons';
import { getInputTokens, inputDeclarations, inspectInputTheme } from '../inputs';
import { deepMergeTheme } from './theme-validate';

/**
 * MIG-B6-29 (FEAT-008), phase 2/4 — the accessibility contrast gate
 * (`checkThemeContrast`), step 7 of the story's own "Implementación".
 * MIG-B6-16 uses this for `uxdsl theme --contrast`.
 *
 * Deliberately does not implement its own color/theme resolution: every
 * pair checked here comes from calling the *same* functions the real
 * compiler calls (`surfaceDeclarations`, `buttonDeclarations`,
 * `inputDeclarations`, `inspectSurfaceTheme`/`inspectButtonTheme`/
 * `inspectInputTheme`, `generateFoundationCss`) — never a hand-written
 * list of pairs, and never a second parser that could drift from what
 * PostCSS/the runtime actually emit. "No inventar CSS que el motor no
 * emite" (the story's own words) is the reason every accessor below
 * reaches into an existing engine module instead of re-deriving anything.
 *
 * What this checks, precisely (see `ContrastReport` below for what it
 * does not): for every Surface/Button/Input role, for every tone
 * `getToneFamilies` recognizes (plus the untoned/primary default), for
 * every state the role/family defines (including the implicit "base"),
 * for both light and (if `modes.dark` exists) dark mode, for the width of
 * every configured breakpoint:
 *   - text color vs. its effective background (4.5:1, WCAG 1.4.3);
 *   - input placeholder color vs. its effective background (4.5:1 — WCAG
 *     itself is more permissive about placeholder text specifically; this
 *     story asks for the same normal-text threshold, so that is what this
 *     checks, not a relaxed one);
 *   - border/underline color vs. the theme's ambient page background,
 *     `palette.surface.main` (3:1, WCAG 1.4.11 non-text contrast).
 *
 * "Effective background": a role's own `background` field if it resolves
 * to something opaque; otherwise (transparent, or a resolved alpha < 1)
 * the ambient page background, `palette.surface.main`, composited
 * underneath. Border/underline are checked only against that same ambient
 * background (the outer, page-facing side of the component boundary) —
 * not also against the component's own inner background — a deliberate
 * simplification of "cada rol sobre surface.main", disclosed here and in
 * the story's own evidence rather than silently assumed.
 */

// ---------------------------------------------------------------------
// Color primitives — parsing, luminance, contrast ratio, compositing.
// Pure, theme-independent; the only place actual color math happens.
// ---------------------------------------------------------------------

export interface RGBA { r: number; g: number; b: number; a: number }

function clamp01(n: number): number { return Math.min(1, Math.max(0, n)); }

function parseHex(input: string): RGBA | null {
  const hex = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    const [r, g, b] = hex.split('').map((c) => parseInt(c + c, 16));
    return { r, g, b, a: 1 };
  }
  if (/^[0-9a-f]{4}$/i.test(hex)) {
    const [r, g, b, a] = hex.split('').map((c) => parseInt(c + c, 16));
    return { r, g, b, a: clamp01(a / 255) };
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }
  if (/^[0-9a-f]{8}$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: clamp01(parseInt(hex.slice(6, 8), 16) / 255),
    };
  }
  return null;
}

function parseFunctional(input: string): RGBA | null {
  const match = input.trim().match(/^(rgba?|hsla?)\(([^)]*)\)$/i);
  if (!match) return null;
  const kind = match[1].toLowerCase();
  const parts = match[2].split(/[\s,/]+/).filter(Boolean);
  const num = (part: string, isAlpha = false): number => {
    if (part.endsWith('%')) return parseFloat(part) / 100 * (isAlpha ? 1 : 255);
    return parseFloat(part);
  };
  if (kind.startsWith('rgb')) {
    if (parts.length < 3) return null;
    const [r, g, b] = [num(parts[0]), num(parts[1]), num(parts[2])];
    const a = parts.length > 3 ? clamp01(num(parts[3], true)) : 1;
    if ([r, g, b].some((n) => !Number.isFinite(n))) return null;
    return { r: clamp01(r / 255) * 255, g: clamp01(g / 255) * 255, b: clamp01(b / 255) * 255, a };
  }
  if (kind.startsWith('hsl')) {
    if (parts.length < 3) return null;
    const h = ((parseFloat(parts[0]) % 360) + 360) % 360;
    const s = clamp01(parseFloat(parts[1]) / 100);
    const l = clamp01(parseFloat(parts[2]) / 100);
    const a = parts.length > 3 ? clamp01(num(parts[3], true)) : 1;
    if (![h, s, l].every(Number.isFinite)) return null;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let [r1, g1, b1] = [0, 0, 0];
    if (h < 60) [r1, g1, b1] = [c, x, 0];
    else if (h < 120) [r1, g1, b1] = [x, c, 0];
    else if (h < 180) [r1, g1, b1] = [0, c, x];
    else if (h < 240) [r1, g1, b1] = [0, x, c];
    else if (h < 300) [r1, g1, b1] = [x, 0, c];
    else [r1, g1, b1] = [c, 0, x];
    return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255, a };
  }
  return null;
}

/** Parses a literal CSS color (hex, rgb()/rgba(), hsl()/hsla(), the
 * `transparent` keyword). Not a general CSS color parser — named colors
 * (`red`, `black`, ...) and newer color spaces (`oklch()`, `color()`) are
 * deliberately unsupported: this theme never emits them, and silently
 * guessing a value for one this engine cannot actually verify would be
 * worse than reporting it `unresolved`. */
export function parseLiteralColor(input: string): RGBA | null {
  const value = input.trim();
  if (/^transparent$/i.test(value)) return { r: 0, g: 0, b: 0, a: 0 };
  if (value.startsWith('#')) return parseHex(value);
  return parseFunctional(value);
}

/** WCAG relative luminance (sRGB -> linear -> weighted sum). */
export function relativeLuminance(color: { r: number; g: number; b: number }): number {
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
}

/** WCAG contrast ratio, 1:1 (identical) to 21:1 (black on white). */
export function contrastRatio(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Standard "source over" alpha compositing: `fg` painted on top of an
 * opaque `bg`. `fg.a === 1` returns `fg` unchanged. */
export function compositeOver(fg: RGBA, bg: { r: number; g: number; b: number }): { r: number; g: number; b: number } {
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
  };
}

// ---------------------------------------------------------------------
// Resolving a *compiled* UXDSL value expression (already past
// presetValueToCss — `var(...)`, `color-mix(...)`, or a literal) down to
// a concrete color, against a flat map of every custom property this
// theme's real generators emit at one (mode, viewport) pair.
// ---------------------------------------------------------------------

export type ResolvedColor = { ok: true; color: RGBA } | { ok: false; reason: string };

const MAX_VAR_CHASE = 25; // generous; a real cycle is the only way to hit this.

/** Extracts the color-looking token from a border/underline shorthand
 * (`"1px solid var(--x)"`, `"1px solid #112233"`, `"none"`). Walks
 * space-separated (top-level) tokens right-to-left and returns the first
 * one that looks like a color reference — width (`1px`) and style
 * (`solid`/`dashed`/`none`) keywords never do. `"none"` alone (no color
 * at all) resolves as fully transparent, matching how a browser paints
 * no visible border. */
function extractBorderColorToken(shorthand: string): string {
  const trimmed = shorthand.trim();
  if (/^none$/i.test(trimmed)) return 'transparent';
  // A var()/color-mix() call may itself contain spaces/commas; split only
  // on whitespace *outside* balanced parentheses.
  const tokens: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of trimmed) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ' ' && depth === 0) {
      if (current) tokens.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (/^(var|color-mix)\(/i.test(token) || /^#[0-9a-f]+$/i.test(token) || /^(rgba?|hsla?)\(/i.test(token) || /^transparent$/i.test(token)) {
      return token;
    }
  }
  return trimmed; // best-effort fallback; resolveExpression will report it unresolved if it truly isn't a color.
}

function resolveVarCall(expr: string, varMap: Record<string, string>, depth: number): ResolvedColor {
  const match = expr.trim().match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]*))?\)$/);
  if (!match) return { ok: false, reason: `not a var() call: ${expr}` };
  const [, name, fallback] = match;
  if (Object.prototype.hasOwnProperty.call(varMap, name)) {
    return resolveExpression(varMap[name], varMap, depth + 1);
  }
  if (fallback !== undefined) return resolveExpression(fallback, varMap, depth + 1);
  return { ok: false, reason: `undefined custom property ${name}` };
}

function resolveColorMix(expr: string, varMap: Record<string, string>, depth: number): ResolvedColor {
  // Only the one shape presetValueToCss ever emits: color-mix(in srgb, X Y%, transparent)
  const match = expr.trim().match(/^color-mix\(\s*in\s+srgb\s*,\s*([\s\S]+?)\s+([\d.]+)%\s*,\s*transparent\s*\)$/i);
  if (!match) return { ok: false, reason: `unsupported color-mix() shape: ${expr}` };
  const [, base, percent] = match;
  const resolved = resolveExpression(base, varMap, depth + 1);
  if (!resolved.ok) return resolved;
  const p = clamp01(parseFloat(percent) / 100);
  return { ok: true, color: { ...resolved.color, a: resolved.color.a * p } };
}

/** Resolves any compiled UXDSL value expression — a bare `var()`, a
 * `var(x, fallback)` chain, `color-mix(in srgb, X Y%, transparent)`
 * (exactly what `presetValueToCss` emits for `palette(x, alpha)`), a
 * border/underline shorthand, or a literal color — down to a concrete
 * RGBA, or a disclosed `unresolved` reason. Never throws: an
 * unresolvable color is exactly the case the story requires to fail the
 * gate loudly, not silently. */
export function resolveExpression(expr: string, varMap: Record<string, string>, depth = 0): ResolvedColor {
  const value = expr.trim();
  if (!value) return { ok: false, reason: 'empty value' };
  if (depth > MAX_VAR_CHASE) return { ok: false, reason: `cycle or excessive chain resolving "${expr}"` };
  const literal = parseLiteralColor(value);
  if (literal) return { ok: true, color: literal };
  if (/^var\(/i.test(value)) return resolveVarCall(value, varMap, depth);
  if (/^color-mix\(/i.test(value)) return resolveColorMix(value, varMap, depth);
  // Not a bare color — try it as a border/underline shorthand ("1px solid X").
  const borderToken = extractBorderColorToken(value);
  if (borderToken !== value) return resolveExpression(borderToken, varMap, depth + 1);
  return { ok: false, reason: `cannot resolve "${expr}" to a color` };
}

// ---------------------------------------------------------------------
// Building the flat, per-(mode, viewport) custom-property map every
// resolution above reads from — entirely from the real generators.
// ---------------------------------------------------------------------

function parseFlatRootDecls(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  postcss.parse(css).walkDecls(/^--/, (decl) => {
    out[decl.prop] = decl.value;
  });
  return out;
}

interface ModeMaps { palette: Record<string, string> }

function buildPaletteMaps(theme: Record<string, any>): { light: ModeMaps; dark: ModeMaps | null } {
  const light = parseFlatRootDecls(generateFoundationCss({ ...theme, modes: undefined }));
  const darkPalette = theme.modes?.dark?.palette;
  if (!darkPalette || typeof darkPalette !== 'object') return { light: { palette: light }, dark: null };
  // Same merge foundations.ts's own dark-mode block conceptually applies
  // (modes.dark.palette overlaid on the light palette, per key) — computed
  // here via the same deepMergeTheme the rest of the compiler uses, not a
  // hand-rolled merge, then run back through the real generator so the
  // resulting map comes from generateFoundationCss too, not a second
  // resolution path.
  const mergedDarkTheme = { ...theme, palette: deepMergeTheme(theme.palette || {}, darkPalette), modes: undefined };
  const dark = parseFlatRootDecls(generateFoundationCss(mergedDarkTheme));
  return { light: { palette: light }, dark: { palette: dark } };
}

function viewportsOf(theme: Record<string, any>): number[] {
  const bps: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...(theme.breakpoints || {}) };
  return Array.from(new Set(Object.values(bps))).sort((a, b) => a - b);
}

// ---------------------------------------------------------------------
// Report shape, shared with MIG-B6-16 (`uxdsl theme --contrast`).
// ---------------------------------------------------------------------

export type ContrastMode = 'light' | 'dark';
export type ContrastPairKind = 'text' | 'placeholder' | 'border';

export interface ContrastFailure {
  mode: ContrastMode;
  family: 'surface' | 'button' | 'input';
  component: string;
  tone: string | null;
  state: string;
  pair: ContrastPairKind;
  background: string;
  breakpoint: number;
  ratio: number | null; // null when unresolved
  required: number;
  reason: string;
}

export interface ContrastExceptionRecord {
  id: string;
  mode: ContrastMode;
  family: string;
  component: string;
  tone: string | null;
  state: string;
  pair: ContrastPairKind;
  background: string;
  resolved: { foreground: string; background: string };
  reason: string;
}

export interface ContrastCheckedPair {
  mode: ContrastMode;
  family: 'surface' | 'button' | 'input';
  component: string;
  tone: string | null;
  state: string;
  pair: ContrastPairKind;
  background: string;
  breakpoint: number;
  ratio: number | null;
  required: number;
  exempt: boolean; // e.g. a disabled state: computed, reported, not held to the normative threshold.
}

export interface ContrastReport {
  /** `true` iff zero non-exempted failures remain, no exception is stale
   * or duplicated, after exceptions are applied. Does NOT mean every pair
   * passed outright — an excepted or exempt failure still is one, just
   * not a blocking one. Every exception is listed in `exceptions` even
   * when `passed` is `true`, so a report can never silently imply
   * "everything actually passed". */
  passed: boolean;
  failures: ContrastFailure[];
  exceptions: Array<{ record: ContrastExceptionRecord; matched: boolean }>;
  /** Problems with the exceptions list itself, not with the theme's
   * colors: a duplicate `id`, or an exception that matched nothing (the
   * override/theme moved on and the recorded resolved colors no longer
   * occur) — both fail the gate per the story's own "una excepción
   * obsoleta o duplicada falla en CI", so a stale exception can never
   * silently keep "covering" a color that has since changed. */
  exceptionIssues: string[];
  checked: ContrastCheckedPair[];
}

const AMBIENT_BACKGROUND_EXPRESSION = 'var(--uxdsl__palette__surface-main)';

function isOpaque(color: RGBA): boolean { return color.a >= 0.999; }

function pairId(p: { mode: string; family: string; component: string; tone: string | null; state: string; pair: string }): string {
  return `${p.mode}.${p.family}.${p.component}.${p.tone ?? '-'}.${p.state}.${p.pair}`;
}

/**
 * Checks every text/placeholder/border pair this theme's Surface/Button/
 * Input engines actually define, in both light and (if present)
 * `modes.dark`, at every configured breakpoint width, against WCAG's
 * normal-text (4.5:1) and non-text (3:1, WCAG 1.4.11) thresholds.
 *
 * This is a compiled-output check, not a DOM/browser certification: it
 * verifies the *colors this theme resolves to*, not how an actual page
 * renders them (no layout, no stacking context, no `filter`/`mix-blend-mode`,
 * no arbitrary author CSS on top of what these engines emit). An
 * `unresolved` color always fails — it is never treated as a 0 ratio
 * (which would also fail, but for the wrong, silently-misleading reason)
 * or as an automatic pass.
 */
export function checkThemeContrast(
  theme: Record<string, any>,
  options: { exceptions?: ContrastExceptionRecord[] } = {}
): ContrastReport {
  const { light, dark } = buildPaletteMaps(theme);
  const toneFamilies = getToneFamilies(theme.palette || {});
  const viewports = viewportsOf(theme);
  const checked: ContrastCheckedPair[] = [];
  const failures: ContrastFailure[] = [];
  const exceptionMatches = new Map<string, boolean>();
  (options.exceptions || []).forEach((e) => exceptionMatches.set(e.id, false));
  // Enumerating every tone × breakpoint is how "todos sus estados... y cada
  // intervalo responsive" (the story's own requirement) gets covered without
  // hand-picking which combinations matter — but most fields (e.g. a
  // 'contained'/'flat' surface's `border`, which surfaceDeclarations never
  // varies by tone; a color with no responsive expression at all) resolve
  // to the *identical* pair under many different (tone, breakpoint)
  // enumeration paths. Reporting each of those as a separate failure would
  // inflate one real problem into a dozen. Two (mode, family, component,
  // state, pair) checks that resolve to the exact same colors are the same
  // finding; this collapses them, keeping only the first (tone, breakpoint)
  // that produced it. A tone or breakpoint that genuinely changes the
  // resolved colors (e.g. 'outlined' role's tone-dependent border) still
  // produces its own distinct entry, since its signature differs for real.
  const seenSignatures = new Set<string>();

  const modes: Array<{ mode: ContrastMode; paletteMap: Record<string, string> }> = [{ mode: 'light', paletteMap: light.palette }];
  if (dark) modes.push({ mode: 'dark', paletteMap: dark.palette });

  for (const { mode, paletteMap } of modes) {
    const ambient = resolveExpression(AMBIENT_BACKGROUND_EXPRESSION, paletteMap);

    for (const viewport of viewports) {
      // Buttons'/inputs' own `base` declarations are exactly
      // `surfaceDeclarations(theme, pack.surface, tone)` (control-engine.ts's
      // `composed`) — their var references point at `--uxdsl__surface__*`
      // custom properties, not `--uxdsl__button__*`/`--uxdsl__input__*` ones.
      // Every map below needs the surface layer merged in too, or every
      // base-state field resolves to "undefined custom property".
      const surfaceVars = inspectSurfaceTheme(theme, viewport);
      const edgeVars = inspectEdgeTheme(theme, viewport);
      const shadowVars = inspectShadowTheme(theme, viewport);
      const surfaceMap = { ...paletteMap, ...surfaceVars, ...edgeVars, ...shadowVars };
      const buttonMap = { ...paletteMap, ...surfaceVars, ...edgeVars, ...shadowVars, ...inspectButtonTheme(theme, viewport) };
      const inputMap = { ...paletteMap, ...surfaceVars, ...edgeVars, ...shadowVars, ...inspectInputTheme(theme, viewport) };

      const effectiveBackground = (bgExpr: string, varMap: Record<string, string>): ResolvedColor => {
        const resolved = resolveExpression(bgExpr, varMap);
        if (resolved.ok && isOpaque(resolved.color)) return resolved;
        if (!ambient.ok) return ambient;
        if (!resolved.ok) return { ok: true, color: { ...ambient.color, a: 1 } }; // fully transparent bg: page shows through entirely.
        return { ok: true, color: { ...compositeOver(resolved.color, ambient.color), a: 1 } };
      };

      const record = (entry: {
        family: 'surface' | 'button' | 'input';
        component: string;
        tone: string | null;
        state: string;
        pair: ContrastPairKind;
        fgExpr: string | undefined;
        bgColor: ResolvedColor;
        backgroundLabel: string;
        varMap: Record<string, string>;
        exempt?: boolean;
      }) => {
        const required = entry.pair === 'border' ? 3 : 4.5;
        const base = { mode, family: entry.family, component: entry.component, tone: entry.tone, state: entry.state, pair: entry.pair, background: entry.backgroundLabel, breakpoint: viewport, required };
        if (!entry.fgExpr) return; // field not defined for this role/state at all — nothing to check, not a failure.
        const fg = resolveExpression(entry.fgExpr, entry.varMap);
        // WCAG 1.4.11 requires a *visible* non-text boundary to be
        // distinguishable from what's around it — it does not require a
        // role that deliberately draws no border ('flat''s `border: none`,
        // 'underline''s `border: none` in favor of its own `underline`
        // field) to have one. Without this, "no border" always scored a
        // perfect, meaningless 1:1 ratio against itself (transparent
        // composited onto the ambient background *is* the ambient
        // background), which is not a contrast failure — it is the
        // absence of the thing being measured.
        if (entry.pair === 'border' && fg.ok && fg.color.a === 0) return;
        let ratio: number | null = null;
        let reason = '';
        if (!fg.ok) reason = fg.reason;
        else if (!entry.bgColor.ok) reason = entry.bgColor.reason;
        else {
          const composited = isOpaque(fg.color) ? fg.color : compositeOver(fg.color, entry.bgColor.color);
          ratio = contrastRatio(composited, entry.bgColor.color);
        }
        const fgSignature = fg.ok ? rgbToHex(fg.color) + (fg.color.a < 1 ? `@${fg.color.a.toFixed(3)}` : '') : `unresolved:${fg.reason}`;
        const bgSignature = entry.bgColor.ok ? rgbToHex(entry.bgColor.color) : `unresolved:${entry.bgColor.reason}`;
        const signature = [mode, entry.family, entry.component, entry.state, entry.pair, fgSignature, bgSignature].join('|');
        if (seenSignatures.has(signature)) return;
        seenSignatures.add(signature);
        checked.push({ ...base, ratio, exempt: !!entry.exempt });
        const passes = ratio !== null && ratio >= required;
        if (passes) return;
        const id = pairId(base);
        const exception = (options.exceptions || []).find((e) =>
          e.mode === mode && e.family === entry.family && e.component === entry.component &&
          e.tone === entry.tone && e.state === entry.state && e.pair === entry.pair && e.background === entry.backgroundLabel
        );
        if (exception) {
          const fgHex = fg.ok ? rgbToHex(fg.color) : null;
          const bgHex = entry.bgColor.ok ? rgbToHex(entry.bgColor.color) : null;
          const exact = fgHex === exception.resolved.foreground && bgHex === exception.resolved.background;
          if (exact) {
            exceptionMatches.set(exception.id, true);
            return; // exact-match exception: does not count as a failure, exempt or not.
          }
        }
        if (entry.exempt) return; // e.g. disabled state: computed and checked, never blocking.
        failures.push({ ...base, ratio, reason: reason || `${ratio!.toFixed(2)}:1 < ${required}:1` });
      };

      // Surfaces: no states of their own.
      for (const role of Object.keys(getSurfaceTokens(theme))) {
        for (const tone of [null, ...toneFamilies]) {
          const decl = surfaceDeclarations(theme, role, tone || '');
          const bg = effectiveBackground(decl.background, surfaceMap);
          record({ family: 'surface', component: role, tone, state: 'base', pair: 'text', fgExpr: decl.color, bgColor: bg, backgroundLabel: 'own-bg-or-ambient', varMap: surfaceMap });
          record({ family: 'surface', component: role, tone, state: 'base', pair: 'border', fgExpr: decl.border, bgColor: ambient, backgroundLabel: 'ambient', varMap: surfaceMap });
        }
      }

      // Buttons: base + every declared state, per tone.
      for (const role of Object.keys(getButtonTokens(theme))) {
        for (const tone of [null, ...toneFamilies]) {
          const { base, states } = buttonDeclarations(theme, role, tone || '');
          const byState: Record<string, Record<string, string>> = { base, ...states };
          let running: Record<string, string> = {};
          for (const [state, fields] of Object.entries(byState)) {
            running = { ...running, ...fields }; // CSS cascade: a state only overrides what it sets.
            const bg = effectiveBackground(running.background, buttonMap);
            record({ family: 'button', component: role, tone, state, pair: 'text', fgExpr: running.color, bgColor: bg, backgroundLabel: 'own-bg-or-ambient', varMap: buttonMap, exempt: state === 'disabled' });
            record({ family: 'button', component: role, tone, state, pair: 'border', fgExpr: running.border, bgColor: ambient, backgroundLabel: 'ambient', varMap: buttonMap, exempt: state === 'disabled' });
          }
        }
      }

      // Inputs: base + every declared state, per tone; placeholder too.
      for (const role of Object.keys(getInputTokens(theme))) {
        for (const tone of [null, ...toneFamilies]) {
          const { base, states } = inputDeclarations(theme, role, tone || '');
          const byState: Record<string, Record<string, string>> = { base, ...states };
          let running: Record<string, string> = {};
          for (const [state, fields] of Object.entries(byState)) {
            running = { ...running, ...fields };
            const bg = effectiveBackground(running.background, inputMap);
            const exempt = state === 'disabled';
            record({ family: 'input', component: role, tone, state, pair: 'text', fgExpr: running.color, bgColor: bg, backgroundLabel: 'own-bg-or-ambient', varMap: inputMap, exempt });
            record({ family: 'input', component: role, tone, state, pair: 'placeholder', fgExpr: running.placeholder, bgColor: bg, backgroundLabel: 'own-bg-or-ambient', varMap: inputMap, exempt });
            record({ family: 'input', component: role, tone, state, pair: 'border', fgExpr: running.border, bgColor: ambient, backgroundLabel: 'ambient', varMap: inputMap, exempt });
            if (running.underline) {
              record({ family: 'input', component: role, tone, state, pair: 'border', fgExpr: running.underline, bgColor: ambient, backgroundLabel: 'ambient', varMap: inputMap, exempt });
            }
          }
        }
      }
    }
  }

  const exceptions = (options.exceptions || []).map((record) => ({ record, matched: exceptionMatches.get(record.id) ?? false }));
  const exceptionIssues: string[] = [];
  // Object, not Map: a bare `for...of` over a Map/Set needs
  // --downlevelIteration or an ES2015+ target — this file gets bundled
  // straight from source by consumers targeting ES5 (the Next.js
  // playground's own next.config.js aliases postcss-uxdsl/* to this
  // package's TypeScript source, "to consume current engine source, not a
  // stale local dist"), so every iteration here stays array-based, the
  // same convention the rest of this package's src/ already follows.
  const idCounts: Record<string, number> = {};
  for (const e of options.exceptions || []) idCounts[e.id] = (idCounts[e.id] || 0) + 1;
  for (const [id, count] of Object.entries(idCounts)) if (count > 1) exceptionIssues.push(`duplicate exception id "${id}" (${count} entries)`);
  for (const { record, matched } of exceptions) if (!matched) exceptionIssues.push(`stale exception "${record.id}": no longer matches any failing pair with its recorded resolved colors`);
  return { passed: failures.length === 0 && exceptionIssues.length === 0, failures, exceptions, exceptionIssues, checked };
}

function rgbToHex(c: { r: number; g: number; b: number }): string {
  const h = (n: number) => Math.round(clamp01(n / 255) * 255).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}
