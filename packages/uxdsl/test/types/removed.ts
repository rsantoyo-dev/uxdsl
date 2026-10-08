// Stability phase 1: the plugin options `breakpoints`, `themeVar`, `spaceVar`
// and `colorVar` are removed, and so are the `UxDslOptions` alias and the
// `UxdslBreakpointSpec` type. Every line below must be a type error — an
// unused `@ts-expect-error` (TS2578) means one of them came back.
import type { UxdslOptions } from 'uxdsl';

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

// The supported options still type-check.
export const supported: UxdslOptions = {
  theme: { breakpoints: { md: 800 } },
  includeTheme: true,
  discoverTheme: false,
  configRoot: './',
  references: { mode: 'error' },
};
