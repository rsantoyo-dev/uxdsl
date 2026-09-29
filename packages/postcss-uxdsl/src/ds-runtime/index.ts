// The browser runtime: one JSON theme, applied per document.
//
// A build compiles the project's theme JSON; `applyTheme` applies the same JSON
// in the browser by replacing the custom properties of one managed `<style>`.
// That is the whole runtime API. There is no per-token setter and no
// breakpoint rewriter: the previous `updatePalette`/`updateSpacing`/
// `updateBreakpoint` family wrote inline styles on `<html>` and rewrote compiled
// media queries with a regex, which competed with — and silently beat — the
// managed stylesheet. The mapping from those calls to `applyTheme` patches is
// in the CHANGELOG ("Removed", stability phase 2).
export {
  applyTheme,
  getAppliedTheme,
  resetTheme,
  loadPersistedTheme,
  subscribeTheme,
  DEFAULT_THEME_STYLE_ID,
  DEFAULT_THEME_STORAGE_KEY,
} from './apply-theme';
export type { ThemeResult, ApplyThemeOptions, LoadPersistedThemeOptions, ThemeOverride } from './apply-theme';
// Isomorphic helpers `applyTheme` gates patches with; exported for tooling that
// wants to ask "would this patch need a rebuild?" without touching a document.
export { themeStructure, structuralChanges } from './theme-structure';
export type { ThemeStructure, ControlStructure } from './theme-structure';
