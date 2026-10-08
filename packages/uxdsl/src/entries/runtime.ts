// `uxdsl/runtime` — the browser theme API: one JSON theme, applied per
// document by replacing the custom properties of one managed `<style>`.
//
// Browser-safe: nothing reachable from this entry imports PostCSS
// (test/runtime-bundle.test.js bundles it and checks). On the server, use
// `generateThemeCss` from `uxdsl/theme` instead; it is pure and per request.
export {
  applyTheme,
  getAppliedTheme,
  resetTheme,
  subscribeTheme,
  loadPersistedTheme,
  DEFAULT_THEME_STYLE_ID,
  DEFAULT_THEME_STORAGE_KEY,
} from '../ds-runtime/apply-theme';
export type { ThemeResult, ApplyThemeOptions, LoadPersistedThemeOptions, ThemeOverride } from '../ds-runtime/apply-theme';
