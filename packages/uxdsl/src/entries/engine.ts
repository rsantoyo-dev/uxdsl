// `uxdsl/engine` — the per-family engines and the helpers tooling builds on:
// every `generate*Css`, `inspect*Theme`, `compile*Rules`, `*Declarations`,
// `*ComponentCss`, the token getters and defaults, the reference checker, the
// structure gate `applyTheme` uses, and the color primitives behind the
// contrast gate. The playground's live demos are written against it.
//
// NOT covered by semver: this is a tooling API and may change in a minor
// release. Build an application on `uxdsl`, `uxdsl/postcss`, `uxdsl/runtime`,
// `uxdsl/theme`, `uxdsl/language` and `uxdsl/config` instead.
//
// Browser-bundleable (the playground runs it client-side) but not
// browser-light: `inspectReferences` reads a PostCSS root, so this entry
// imports PostCSS. `uxdsl/runtime` does not.
export * from '../language';
export * from '../typography';
export * from '../edges';
export * from '../shadows';
export * from '../surfaces';
export * from '../buttons';
export * from '../inputs';
export { generateFoundationCss, foundationBlocks } from '../foundations';
export { renderThemeCss, generateThemeCss } from '../ds-runtime/theme-generator';
export * from '../ds-runtime/theme-validate';
export * from '../ds-runtime/contrast';
export { themeStructure, structuralChanges } from '../ds-runtime/theme-structure';
export type { ThemeStructure, ControlStructure } from '../ds-runtime/theme-structure';
export { inspectReferences, ReferenceIntegrityError } from '../reference-integrity';
export { inspectDeclarationReferences } from '../reference-core';
export type { ReferenceOptions, ReferenceIssue, ReferenceDeclaration } from '../reference-core';
export { serializeBlock, serializeBlocks, responsiveBlocks, blockDeclarations } from '../css-blocks';
export type { CssBlock, ResponsiveRule } from '../css-blocks';
export { splitSelectorList } from '../control-engine';
export { DEFAULT_THEME, resolveTheme } from '../default-theme';
export { encodeGoogleFontFamily, googleFontsImportUrls } from '../fonts';
export { DIAGNOSTIC_CATALOG, DIAGNOSTIC_CODES } from '../diagnostics';
export type { DiagnosticEntry, DiagnosticOwner } from '../diagnostics';
