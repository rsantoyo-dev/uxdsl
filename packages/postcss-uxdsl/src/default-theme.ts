import { deepMergeTheme } from './ds-runtime/theme-validate';
import { BASE_THEME } from './base-theme';

/**
 * MIG-B6-29 (FEAT-008): `DEFAULT_THEME` is the reviewed `theme/base.json`
 * itself — colors, fonts (including `fonts.google`), breakpoints, spacing,
 * densities, borders, radii, shadows, the full 14-family palette,
 * `modes.dark`, surfaces, buttons, inputs and typography_details — not a
 * "deliberately minimal" 4-family subset hand-picked to avoid crashes.
 * Before this, four different places answered "what are the defaults"
 * (this file's own minimal literal, the full JSON the playground alone
 * used, values hardcoded in typography.ts/typography-defaults.ts, and the
 * opt-in legacy `default-*.css`/`.uxdsl` packs) and their values diverged
 * (see the story's own reproduction). Now there is one: `theme/base.json`,
 * loaded once and deep-frozen by `base-theme.ts`; every engine
 * (`language.ts`, `edges.ts`, `shadows.ts`, `surfaces.ts`, `buttons.ts`,
 * `inputs.ts`) derives its own `DEFAULT_*` export from the same object
 * instead of maintaining a parallel literal.
 *
 * `typography-defaults.ts`'s `DEFAULT_TYPOGRAPHY` (a *different*,
 * richer-but-differently-shaped typography map, previously spliced in here
 * with an ad hoc `default.fontSize`/`code.fontSize` patch to plug a
 * zero-config crash) no longer feeds `DEFAULT_THEME` — the JSON's own
 * `typography_details` is already complete on its own terms. That file is
 * left as-is; MIG-B6-17 owns removing whatever `@ds-typo` consumption-side
 * fallback logic still assumes the old shape (see this story's own
 * evidence for the specific fields this can affect: `@ds-typo` roles no
 * longer inherit `textTransform`/`textDecoration`/`fontStyle`/
 * `marginBlockStart`/`marginBlockEnd` from a `typography_details.default`
 * that used to provide them and no longer does).
 */
export const DEFAULT_THEME: Readonly<Record<string, any>> = BASE_THEME;

/**
 * The one place an "effective theme" is built: `DEFAULT_THEME` with
 * `override` deep-merged on top (object keys merge, arrays and scalars
 * replace whole, `undefined` never overwrites — `deepMergeTheme`'s
 * existing contract). Called identically by `generateThemeCss` (runtime)
 * and the PostCSS plugin, so both always resolve the same effective
 * theme for the same input — this is what item 6 requires, not a second,
 * parallel resolution.
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
  return deepMergeTheme(DEFAULT_THEME as Record<string, any>, input);
}
