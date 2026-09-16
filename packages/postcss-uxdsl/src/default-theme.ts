import { deepMergeTheme } from './ds-runtime/theme-validate';
import { normalizeSpacingDefinitions } from './language';
import { DEFAULT_TYPOGRAPHY } from './typography-defaults';

/**
 * MIG-B2-02 (FEAT-003): a single canonical default theme, merged under
 * whatever a consumer provides, so `generateThemeCss()`/the PostCSS plugin
 * produce valid, strictly-passing CSS from an omitted or partial theme
 * instead of failing with `UXD_REFERENCE_MISSING` for every family that
 * has no built-in fallback of its own.
 *
 * Scope is deliberately minimal: exactly the tokens the *always-on*
 * presets (Density, Radius, Surface, Button, Input — none of which can be
 * turned off short of `includeTheme: false`, which skips emission but
 * still validates against this same effective theme) reference and had no
 * default for before this. Radius/Shadow/Border/Surface/Button/Input
 * shapes themselves already default via `DEFAULT_RADII`/`DEFAULT_SHADOWS`/
 * `DEFAULT_BORDERS`/`DEFAULT_BORDER_COLORS`/`DEFAULT_SURFACES`/
 * `DEFAULT_BUTTONS`/`DEFAULT_INPUTS` in their own modules — this file does
 * not duplicate those. `theme.colors.gray` is deliberately NOT set here
 * even though it would visually match: `DEFAULT_BORDER_COLORS` (edges.ts)
 * already supplies it, merged in by `foundations.ts`, and this file
 * merging in a *different* default value for the same `gray` family key
 * would only reintroduce the exact "two divergent default sources" bug
 * this story exists to avoid — one leaked from the other's silently
 * unresolved case rather than one having no default at all.
 *
 * Colors here are literal hex, not `color()` references into
 * `postcss-uxdsl/theme/default-colors.css`'s richer palette (secondary/
 * tertiary/success/info/warning/dark/light + dark-mode variants) — that
 * file remains available as a separate, opt-in, more complete palette;
 * this is only the minimum needed for the compiler to never crash on an
 * incomplete theme. The specific values (purple/slate/red family) were
 * chosen to match that file's own primary/surface/neutral/error entries,
 * so a project that later imports the richer palette sees no visible
 * jump.
 */
export const DEFAULT_THEME: Readonly<Record<string, any>> = Object.freeze({
  spacing: Object.freeze({
    1: '0.125rem', 2: '0.25rem', 3: '0.5rem', 4: '0.75rem', 5: '1rem', 6: '1.5rem',
    7: '2rem', 8: '2.5rem', 9: '3.125rem', 10: '3.875rem', 11: '4.875rem', 12: '6.125rem',
    13: '7.75rem', 14: '9.75rem', 15: '12.25rem', 16: '15.375rem',
  }),
  palette: Object.freeze({
    primary: Object.freeze({ main: '#7e22ce', dark: '#581c87', contrast: '#ffffff' }),
    surface: Object.freeze({ main: '#ffffff', dark: '#dde5eb', contrast: '#102a43' }),
    neutral: Object.freeze({ main: '#e2e8f0', dark: '#cbd5e1' }),
    error: Object.freeze({ main: '#c61625' }),
  }),
  fonts: Object.freeze({
    families: Object.freeze({
      ui: 'Inter, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      'ui-2': 'Roboto, "Helvetica Neue", Arial, sans-serif',
      code: 'Menlo, "SF Mono", Monaco, Inconsolata, "Roboto Mono", "Source Code Pro", monospace',
    }),
  }),
  // MIG-B2-03: the legacy postcss-uxdsl/theme/default-typography.uxdsl pack
  // remains available for explicit imports, but `generate-entry` no longer
  // imports it automatically. That pack fully defines h1-h6/p/span/
  // body/etc. via literal xs()/space() declarations that don't read
  // theme.typography_details at all, but its own `default`/`code` roles
  // (`.ds-typo[data-typo="default"/"code"]`) only cover transform/
  // decoration/style/margin — `fontSize` for those two specifically has
  // always come from theme.typography_details, undocumented anywhere as
  // a requirement. That's the exact zero-config crash this closes: a
  // fresh `uxdsl init` + `uxdsl build`, no theme at all, failed with
  // UXD_REFERENCE_MISSING for --uxdsl__typography__default-size and
  // -code-size. A project with its own typography_details.default/.code
  // still overrides these per-key normally.
  typography_details: Object.freeze({
    ...DEFAULT_TYPOGRAPHY,
    default: Object.freeze({ ...DEFAULT_TYPOGRAPHY.default, fontSize: '1rem' }),
    code: Object.freeze({ fontSize: '0.9rem' }),
  }),
});

/** Returns a fresh, mutable deep copy of `DEFAULT_THEME` — browser-safe
 * (no `structuredClone` dependency assumed) and clonable, per item 2. */
export function getDefaultTheme(): Record<string, any> {
  return JSON.parse(JSON.stringify(DEFAULT_THEME));
}

/**
 * The one place an "effective theme" is built: `DEFAULT_THEME` with
 * `override` deep-merged on top (object keys merge, arrays and scalars
 * replace whole, `undefined` never overwrites — `deepMergeTheme`'s
 * existing contract). Called identically by `generateThemeCss` (runtime)
 * and the PostCSS plugin, so both always resolve the same effective
 * theme for the same input — this is what item 6 requires, not a second,
 * parallel resolution.
 *
 * `spacing` gets one extra step first: `override.spacing`'s keys are
 * normalized to the same canonical form `DEFAULT_THEME.spacing` already
 * uses (`normalizeSpacingDefinitions`, MIG-01's existing "space-1" vs "1"
 * contract) *before* the merge, not after. Merging first and normalizing
 * after would treat a `{ "space-1": "10px" }` override as an *additional*
 * key alongside the default's `"1"`, which is a real distinct key until
 * normalized — silently keeping the default `"1"` value alive alongside
 * the override, or throwing `UXD_SPACING_COLLISION` for what the caller
 * clearly meant as one override, not two conflicting spellings of it.
 */
export function resolveTheme(override?: unknown): Record<string, any> {
  const isPlainObject = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  // A non-object override (a string, number, array, ...) is a caller
  // mistake, not "no override" — silently falling back to DEFAULT_THEME
  // here would hide it. `undefined`/`null` (genuinely "no override") are
  // the only values treated as "use the defaults".
  if (override !== undefined && override !== null && !isPlainObject(override)) {
    throw new Error('UXD_THEME_INVALID: Expected theme to be an object.');
  }
  const input: Record<string, any> = override ? { ...(override as Record<string, any>) } : {};
  if (isPlainObject(input.spacing)) {
    input.spacing = normalizeSpacingDefinitions(input.spacing);
  }
  return deepMergeTheme(DEFAULT_THEME as Record<string, any>, input);
}
