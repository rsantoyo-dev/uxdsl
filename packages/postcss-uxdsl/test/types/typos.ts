// MIG-B6-27 (FEAT-008): the negative half of the type corpus. Every
// `@ts-expect-error` below must be *used* — TypeScript reports an unused one as
// an error of its own, so a type that stops catching a typo fails this file
// rather than quietly passing it.
import { defineConfig } from 'postcss-uxdsl/config';
import type { UxdslTheme, UxdslConfig, UxdslOptions } from 'postcss-uxdsl';

export const configTypo = defineConfig({
  entry: './src/app.uxdsl',
  outFile: './dist/app.css',
  // @ts-expect-error `includeThem` is ignored by the CLI at run time.
  includeThem: false,
});

export const bothEntryAndBuilds = defineConfig(
  // @ts-expect-error the CLI rejects `builds` combined with a top-level entry.
  {
    entry: './src/app.uxdsl',
    outFile: './dist/app.css',
    builds: [{ entry: './src/panel.uxdsl', outFile: './dist/panel.css' }],
  });

export const wrongSourceMap = defineConfig({
  entry: './src/app.uxdsl',
  outFile: './dist/app.css',
  // @ts-expect-error only false, 'inline' and 'external' are accepted.
  sourceMap: 'External',
});

export const buildMissingOut: UxdslConfig = {
  // @ts-expect-error every entry in `builds` needs its own outFile.
  builds: [{ entry: './src/panel.uxdsl' }],
};

export const familyTypo: UxdslTheme = {
  palette: { primary: { main: '#000' } },
  // @ts-expect-error `palete` compiles to nothing.
  palete: { primary: { main: '#000' } },
};

export const typographyFieldTypo: UxdslTheme = {
  // @ts-expect-error `fontsize` is not a typography field; `fontSize` is.
  typography_details: { h1: { fontsize: '2rem' } },
};

export const buttonStateTypo: UxdslTheme = {
  // @ts-expect-error the state is `focusvisible`, all lowercase.
  buttons: { cta: { states: { focusVisible: { bg: 'red' } } } },
};

export const buttonFieldTypo: UxdslTheme = {
  // @ts-expect-error `outlne` is not a Button field.
  buttons: { cta: { base: { outlne: '1px solid red' } } },
};

export const inputStateFromButtons: UxdslTheme = {
  // @ts-expect-error `selected` is a Button state; Inputs have no such state.
  inputs: { search: { states: { selected: { bg: 'red' } } } },
};

export const surfaceFieldTypo: UxdslTheme = {
  // @ts-expect-error `paddng` is not a Surface field.
  surfaces: { card: { paddng: 'density(2)' } },
};

export const roleKeyTypo: UxdslTheme = {
  // @ts-expect-error a control role has `surface`, `base` and `states`.
  buttons: { cta: { surfce: 'contained' } },
};

export const modeTypo: UxdslTheme = {
  // @ts-expect-error only `modes.dark` is compiled.
  modes: { darkk: { palette: {} } },
};

export const breakpointType: UxdslTheme = {
  // @ts-expect-error breakpoints are numbers, not strings.
  breakpoints: { md: '768' },
};

export const googleFontsShape: UxdslTheme = {
  // @ts-expect-error `google` is a list of family specs.
  fonts: { google: 'Inter:wght@400;700' },
};

export const optionsTypo: UxdslOptions = {
  // @ts-expect-error the option is `includeTheme`.
  includeThem: false,
};

export const optionsThemeTypo: UxdslOptions = {
  // @ts-expect-error a theme override is type-checked too, not `any`.
  theme: { palete: {} },
};

export const bothOutSpellings = defineConfig(
  // @ts-expect-error `outFile` and `output` are two spellings of one field.
  {
    entry: './src/app.uxdsl',
    outFile: './dist/app.css',
    output: './dist/app.css',
  });

export const noOutputAtAll = defineConfig(
  // @ts-expect-error an entry needs somewhere to be written.
  { entry: './src/app.uxdsl' });
