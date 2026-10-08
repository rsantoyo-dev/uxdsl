// `uxdsl/config` — the build config helper and theme-file discovery, the one
// contract the CLI, the PostCSS plugin and both bundler adapters share.
// Node only (reads the file system).
//
// A `.cjs` config refers to this entry by name in its JSDoc
// (`@type {import('uxdsl/config').UxdslConfig}`), so the config types are
// reachable from here, not only from the package root.
export { defineConfig, discoverThemeAsync, discoverThemeSync, findThemeConfigPath, THEME_CANDIDATES } from '../config';
export type { DiscoveredTheme } from '../config';
export type { UxdslConfig, UxdslConfigShared, UxdslBuild, UxdslTheme, UxdslThemeOverride } from '../types';
