// MIG-B6-27 (FEAT-008): everything in this file must compile. It is the
// positive half of the type corpus — a type that rejects a valid theme is a
// worse failure than one that misses a typo, because it pushes people to
// delete the annotation.
import { defineConfig } from 'postcss-uxdsl/config';
import type { UxdslConfig, UxdslTheme, UxdslThemeOverride, UxdslOptions, UxDslOptions } from 'postcss-uxdsl';

// A single-entry config.
export const single = defineConfig({
  entry: './src/app.uxdsl',
  outFile: './dist/app.css',
  includeTheme: true,
  strictTheme: ['palette', 'spacing'],
  sourceMap: 'external',
  watch: ['./uxdsl.theme.json'],
  themeFile: './uxdsl.theme.json',
  references: { mode: 'warn', externalTokens: ['--host-accent'] },
});

// A multi-entry config: one theme entry plus component entries.
export const multi = defineConfig({
  builds: [
    { entry: './src/theme.uxdsl', outFile: './dist/theme.css', includeTheme: true },
    { entry: './src/panel.uxdsl', outFile: './dist/panel.css', includeTheme: false },
  ],
  sourceMap: false,
  strictTheme: true,
});

// `satisfies` is the documented route for a config assembled before the call,
// where the excess-property check on a fresh literal no longer applies.
export const prebuilt = {
  entry: './src/app.uxdsl',
  outFile: './dist/app.css',
} satisfies UxdslConfig;

export const theme: UxdslTheme = {
  breakpoints: { xs: 0, md: 768, xl: 1280 },
  // Both spacing key spellings the engine normalizes.
  spacing: { 1: '0.25rem', 'space-2': '0.5rem' },
  palette: {
    // An open registry: a project's own family is valid.
    brand: { main: '#0f172a', dark: '#020617', contrast: '#ffffff' },
    // A semantic group with no `main` — exactly what the base theme's
    // `action` looks like. Requiring `main` here would reject the shipped theme.
    action: { disabled: 'var(--uxdsl__palette__text-disabled)' },
    // A partial override of a family that exists in the base.
    primary: { dark: '#581c87' },
  },
  colors: { white: '#ffffff', gray: { 300: '#CBD5E1', 400: '#94A3B8' } },
  fonts: { families: { ui: 'Inter, sans-serif' }, google: ['Inter:wght@400;700'] },
  typography_details: {
    default: { fontFamily: 'var(--uxdsl__font__ui)', lineHeight: '1.5' },
    // A typography role this package never ships.
    'display-xl': { fontSize: 'xs(space(8)) md(space(10))', fontWeight: '700' },
  },
  densities: { 4: 'xs(space(4)) md(space(5)) xl(space(6))' },
  borders: { 1: 'xs(1px solid #64748b) md(2px solid #64748b)' },
  radii: { 2: 'xs(8px) md(12px)' },
  shadows: { inset: 'inset 0 1px 3px rgba(0, 0, 0, 0.2)' },
  surfaces: { panel: { padding: 'density(2)', radius: 'radius(2)', bg: 'palette(surface.main)' } },
  buttons: {
    checkout: {
      surface: 'contained',
      base: { padding: 'density(2)' },
      states: { focusvisible: { outline: '2px solid palette(primary.main)', 'outline-offset': '3px' } },
    },
  },
  inputs: {
    search: {
      surface: 'outlined',
      base: { padding: 'density(2)', placeholder: 'palette(neutral.dark)' },
      states: { invalid: { border: '2px solid palette(error.main)' } },
    },
  },
  modes: { dark: { palette: { primary: { main: '#ddbfff' } } } },
  typography: { 'font-code': '"JetBrains Mono", monospace' },
};

// An override declares only what it changes.
export const override: UxdslThemeOverride = {
  palette: { primary: { main: '#0ea5e9' } },
  fonts: { google: ['Inter:wght@400;700'] },
};

export const options: UxdslOptions = {
  theme: override,
  includeTheme: false,
  breakpoints: { xs: 0, md: 768 },
  discoverTheme: false,
  // A literal, not `process.cwd()`: this fixture is compiled in a project
  // without `@types/node`, which is the situation of a consumer that only has
  // a browser tsconfig — the public types must not depend on Node's globals.
  configRoot: './',
  references: { mode: 'error' },
};

// The pre-beta.6 spelling still resolves, to the same type.
export const legacyAlias: UxDslOptions = options;

// The CLI still accepts the older `output` spelling, so a working config that
// uses it must keep type-checking once the annotation is added.
export const legacyOutput = defineConfig({
  entry: './src/app.uxdsl',
  output: './dist/app.css',
});

export const legacyOutputInBuilds = defineConfig({
  builds: [{ entry: './src/panel.uxdsl', output: './dist/panel.css' }],
});
