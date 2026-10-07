// The browser runtime (`applyTheme` and friends) — the only part of this module
// that touches a document. Everything below it is isomorphic: theme resolution,
// validation, generation, the contrast gate and the per-family engines.
export * from "./ds-runtime/index";
export * from "./ds-runtime/theme-generator";
export * from "./ds-runtime/theme-validate";
// The accessibility contrast gate.
// The CLI imports `checkThemeContrast` from here for `uxdsl theme --contrast`.
export * from "./ds-runtime/contrast";
export * from "./typography";

export * from './edges';
export * from './shadows';
export * from './surfaces';

export * from './buttons';

export { generateDensityCss, DEFAULT_BREAKPOINTS, DEFAULT_DENSITIES, getDensityTokens } from './language';

export * from './inputs';
export { inspectReferences, ReferenceIntegrityError } from './reference-integrity';
export type { ReferenceOptions, ReferenceIssue } from './reference-integrity';

// The same canonical default theme + resolution `generateThemeCss`
// and the PostCSS plugin already use internally, exported so a consuming app
// can build the identical effective theme during SSR/runtime (item 9).
export { DEFAULT_THEME, resolveTheme } from './default-theme';

// The shared Google Fonts encoder — a
// project managing its own font `<link>`/`@import` (e.g. client-side, the
// way playground-nextjs's ThemeContext.tsx does today) can build the exact
// same URL this package's own compiler and generateThemeCss both emit.
export { encodeGoogleFontFamily, googleFontsImportUrls } from './fonts';

// The frozen catalog of every UXD_* code the compiler, the theme validator,
// this runtime and uxdsl-core can produce: meaning, fix and owner per code.
// The playground's /docs/diagnostics page renders it.
export { DIAGNOSTIC_CATALOG, DIAGNOSTIC_CODES } from './diagnostics';
export type { DiagnosticEntry, DiagnosticOwner } from './diagnostics';
