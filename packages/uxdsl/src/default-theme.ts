import { deepMergeTheme } from './ds-runtime/theme-validate';
import { BASE_THEME } from './base-theme';

/**
 * `DEFAULT_THEME` is the shipped `theme/base.json`, loaded and deep-frozen by
 * `base-theme.ts`: the one set of defaults every engine derives its own
 * `DEFAULT_*` export from. `resolveTheme` builds every effective theme on it.
 */
export const DEFAULT_THEME: Readonly<Record<string, any>> = BASE_THEME;

/**
 * The one place an "effective theme" is built: `DEFAULT_THEME` with
 * `override` deep-merged on top (object keys merge, arrays and scalars
 * replace whole, `undefined` never overwrites — `deepMergeTheme`'s
 * existing contract). Called identically by `generateThemeCss` (runtime)
 * and the PostCSS plugin, so both always resolve the same effective
 * theme for the same input; there is no second, parallel resolution.
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
