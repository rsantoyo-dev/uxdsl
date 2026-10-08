// `uxdsl/theme` — the theme model, isomorphic (Node, SSR and browser):
// resolve an override over the base theme, validate it, generate its CSS,
// check its contrast. The files `uxdsl/theme/base.json`,
// `uxdsl/theme/base.contrast-exceptions.json` and
// `uxdsl/schema/theme.schema.json` sit next to it.
export { DEFAULT_THEME, resolveTheme } from '../default-theme';
export { deepMergeTheme, validateTheme, KNOWN_THEME_FAMILIES } from '../ds-runtime/theme-validate';
export type { ThemeValidationIssue, ThemeValidationResult, ValidateThemeOptions } from '../ds-runtime/theme-validate';
export { generateThemeCss } from '../ds-runtime/theme-generator';
export { checkThemeContrast } from '../ds-runtime/contrast';
export type {
  ContrastReport,
  ContrastFailure,
  ContrastException,
  ContrastExceptionRecord,
  ContrastExceptionPattern,
  ContrastExceptedPair,
  ContrastCheckedPair,
} from '../ds-runtime/contrast';
export { googleFontsImportUrls } from '../fonts';
export { DEFAULT_BREAKPOINTS } from '../language';
export type { BreakpointMap } from '../language';
export type { UxdslTheme, UxdslThemeOverride } from '../types';
