// `uxdsl` — the package root: compile a `.uxdsl` entry (or in-memory source)
// through the one pipeline the CLI, the Vite plugin and the Webpack loader all
// use, plus the theme a build resolves and the config helper.
//
// The other entry points: `uxdsl/postcss` (the PostCSS plugin), `uxdsl/vite`,
// `uxdsl/webpack`, `uxdsl/runtime` (browser), `uxdsl/theme` (isomorphic),
// `uxdsl/language` (editors), `uxdsl/config` and `uxdsl/engine` (tooling;
// exempt from semver).
export { compile } from '../compile';
export type { CompileInput, CompileConfig, CompileResult, CompileWarning } from '../compile';
export { DEFAULT_THEME, resolveTheme } from '../default-theme';
export { defineConfig } from '../config';
export type {
  UxdslOptions,
  UxdslTheme,
  UxdslThemeOverride,
  UxdslDeepPartial,
  UxdslTokenValue,
  UxdslPaletteFamily,
  UxdslColorFamily,
  UxdslFonts,
  UxdslMode,
  UxdslTypographyRole,
  UxdslTypographyField,
  UxdslSurfaceRole,
  UxdslSurfaceField,
  UxdslButtonRole,
  UxdslButtonField,
  UxdslButtonState,
  UxdslInputRole,
  UxdslInputField,
  UxdslInputState,
  UxdslConfig,
  UxdslConfigShared,
  UxdslBuild,
} from '../types';
