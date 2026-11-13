// Stability phase 1: the plugin options `breakpoints`, `themeVar`, `spaceVar`
// and `colorVar` are removed, and so are the `UxDslOptions` alias and the
// `UxdslBreakpointSpec` type. `includeTheme` is removed from the plugin,
// compile(), the build config and the Vite plugin: the theme is emitted where
// `@uxdsl theme;` is written. Every line below must be a type error — an
// unused `@ts-expect-error` (TS2578) means one of them came back.
import type { UxdslOptions, CompileConfig, UxdslConfig } from 'uxdsl';
import type { UxDslPluginOptions } from 'uxdsl/vite';

export const withBreakpoints: UxdslOptions = {
  // @ts-expect-error breakpoints are the theme's own family, not a plugin option.
  breakpoints: { xs: 0, md: 768 },
};

export const withThemeVar: UxdslOptions = {
  // @ts-expect-error the emitted variable names are a contract, not a callback.
  themeVar: (path: string) => `var(--x-${path})`,
};

export const withSpaceVar: UxdslOptions = {
  // @ts-expect-error removed with themeVar.
  spaceVar: (index: string) => `var(--s-${index})`,
};

export const withColorVar: UxdslOptions = {
  // @ts-expect-error removed with themeVar.
  colorVar: (path: string) => `var(--c-${path})`,
};

// @ts-expect-error the pre-beta.6 alias is gone; the type is UxdslOptions.
export type Alias = import('uxdsl').UxDslOptions;

// @ts-expect-error there is one breakpoint shape, the theme's Record<string, number>.
export type Spec = import('uxdsl').UxdslBreakpointSpec;

export const withIncludeTheme: UxdslOptions = {
  // @ts-expect-error the theme goes where `@uxdsl theme;` is written.
  includeTheme: false,
};

export const compileWithIncludeTheme: CompileConfig = {
  // @ts-expect-error compile() has no theme switch; the marker is the switch.
  includeTheme: false,
};

export const configWithIncludeTheme: UxdslConfig = {
  entry: './src/app.uxdsl',
  outFile: './dist/app.css',
  // @ts-expect-error not a build-config key any more.
  includeTheme: false,
};

export const buildsWithIncludeTheme: UxdslConfig = {
  builds: [
    // @ts-expect-error nor a key of a builds[] entry.
    { entry: './src/panel.uxdsl', outFile: './dist/panel.css', includeTheme: false },
  ],
};

export const viteWithIncludeTheme: UxDslPluginOptions = {
  // @ts-expect-error the Vite plugin passes no theme switch to compile().
  includeTheme: false,
};

// The supported options still type-check.
export const supported: UxdslOptions = {
  theme: { breakpoints: { md: 800 } },
  discoverTheme: false,
  configRoot: './',
  references: { mode: 'error' },
};
