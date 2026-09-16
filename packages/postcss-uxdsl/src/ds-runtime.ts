export * from "./ds-runtime/index";
export * from "./ds-runtime/theme-generator";
export * from "./ds-runtime/theme-validate";
export * from "./typography";
export { default } from "./ds-runtime/index";

export * from './edges';
export * from './shadows';
export * from './surfaces';

export * from './buttons';

export { generateDensityCss, DEFAULT_BREAKPOINTS, DEFAULT_DENSITIES, getDensityTokens } from './language';

export * from './inputs';
export { inspectReferences, ReferenceIntegrityError } from './reference-integrity';
export type { ReferenceOptions, ReferenceIssue } from './reference-integrity';

// MIG-B2-02: the same canonical default theme + resolution `generateThemeCss`
// and the PostCSS plugin already use internally, exported so a consuming app
// can build the identical effective theme during SSR/runtime (item 9).
export { DEFAULT_THEME, getDefaultTheme, resolveTheme } from './default-theme';
