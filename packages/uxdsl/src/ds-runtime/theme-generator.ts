// The theme stylesheet: renderTheme turns an effective theme into the CSS the
// plugin and generateThemeCss both emit, byte for byte, and into the
// declarations the reference check reads.

import { foundationBlocks } from '../foundations';
import { compileInputRules } from '../inputs';
import { compileButtonRules } from '../buttons';
import { compileSurfaceRules } from '../surfaces';
import { compileShadowRules } from '../shadows';
import { compileEdgeRules } from '../edges';
import { BreakpointMap, DEFAULT_BREAKPOINTS, compileDensityRules, getDensityTokens, tokenValueToCss } from '../language';
import { typographyBlocks } from '../typography';
import { CssBlock, blockDeclarations, responsiveBlocks, serializeBlocks } from '../css-blocks';
import { enforceDeclarationReferences, ReferenceDeclaration, ReferenceOptions } from '../reference-core';
import { resolveTheme } from '../default-theme';
import { googleFontsImportUrls } from '../fonts';
import { validateTheme, themeValidationError } from './theme-validate';

type ResponsiveRules = Parameters<typeof responsiveBlocks>[0];

/** The generated theme, as blocks: the `@import`s, the foundations (one line),
 * then one run of blocks per family, in the order the stylesheet lists them. */
interface ThemeParts {
  imports: string[];
  foundation: CssBlock[];
  families: CssBlock[][];
}

const themeImports = (theme: Record<string, any>) => googleFontsImportUrls(theme.fonts?.google).map((url) => `@import url('${url}');`);

/** The theme's parts, each engine run here, in the stylesheet's order. */
function themeParts(theme: Record<string, any>, breakpoints: BreakpointMap): ThemeParts {
  return {
    imports: themeImports(theme),
    foundation: foundationBlocks(theme),
    families: [
      typographyBlocks(theme, breakpoints),
      responsiveBlocks(compileEdgeRules(theme, breakpoints)),
      responsiveBlocks(compileShadowRules(theme, breakpoints)),
      responsiveBlocks(compileSurfaceRules(theme, breakpoints)),
      responsiveBlocks(compileButtonRules(theme, breakpoints)),
      responsiveBlocks(compileInputRules(theme, breakpoints)),
      responsiveBlocks(compileDensityRules(getDensityTokens(theme), breakpoints, (value) => tokenValueToCss(value, theme))),
    ],
  };
}

/** The parts as CSS: every `@import` first (CSS honors one only before every
 * other rule), then the foundations and one run per family. */
function themeCss(parts: ThemeParts): string {
  let css = parts.imports.join('\n');
  if (css) css += '\n';
  css += serializeBlocks(parts.foundation, ' ');
  for (const family of parts.families) css += '\n' + serializeBlocks(family);
  return css;
}

/**
 * The theme stylesheet of an *effective* theme, and its declarations as the
 * reference check reads them — both from the same blocks, so what is checked
 * is exactly what is written.
 */
export function renderTheme(theme: Record<string, any>, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }): { css: string; declarations: ReferenceDeclaration[] } {
  const parts = themeParts(theme, breakpoints);
  return { css: themeCss(parts), declarations: blockDeclarations([parts.foundation, ...parts.families].reduce((all, blocks) => all.concat(blocks), [] as CssBlock[])) };
}

/** What `validateTheme`'s engine pass computes for a valid theme: each
 * engine's output, from which the theme stylesheet is serialized without
 * running an engine again. */
export interface ThemeEngineOutputs {
  foundation: CssBlock[];
  /** The font families' block: `typographyBlocks` without `typography_details`. */
  fonts: CssBlock[];
  typography: ResponsiveRules;
  densities: ResponsiveRules;
  inputs: ResponsiveRules;
  buttons: ResponsiveRules;
  surfaces: ResponsiveRules;
  shadows: ResponsiveRules;
  edges: ResponsiveRules;
}

/**
 * The key of `validateTheme`'s options under which a caller may pass a
 * function that receives the engines' outputs when the theme is valid. No
 * entry exports it: the PostCSS plugin passes it, so that a compilation
 * validates and renders its theme with one run of each engine.
 */
export const THEME_ENGINE_OUTPUTS: unique symbol = Symbol('uxdsl.themeEngineOutputs');

/**
 * The theme stylesheet serialized from the engines' outputs for `theme`, the
 * theme they were computed for: the same bytes `renderThemeCss` returns for
 * it, in the same order, the typography rules after the font families as
 * `typographyBlocks` puts them.
 */
export function renderThemeCssFromOutputs(theme: Record<string, any>, outputs: ThemeEngineOutputs): string {
  return themeCss({
    imports: themeImports(theme),
    foundation: outputs.foundation,
    families: [
      outputs.fonts.concat(responsiveBlocks(outputs.typography)),
      responsiveBlocks(outputs.edges),
      responsiveBlocks(outputs.shadows),
      responsiveBlocks(outputs.surfaces),
      responsiveBlocks(outputs.buttons),
      responsiveBlocks(outputs.inputs),
      responsiveBlocks(outputs.densities),
    ],
  });
}

/**
 * The theme stylesheet for an *effective* theme, as a string. Pure and
 * unvalidated — the PostCSS plugin and `generateThemeCss` both emit exactly
 * these bytes, after validating the theme through `validateTheme` (the plugin
 * serializes them from the validator's engine outputs). Callers that already
 * validated may call this directly; anything else goes through
 * `generateThemeCss`.
 */
export function renderThemeCss(theme: Record<string, any>, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }): string {
  return renderTheme(theme, breakpoints).css;
}

/** Omitted/partial themes resolve against `DEFAULT_THEME` before generating
 * or validating — `generateThemeCss()` with no arguments produces the base
 * theme's CSS.
 *
 * The effective theme goes through `validateTheme` first (structure,
 * breakpoints, engines), so a numeric leaf or a `"768"` breakpoint is an error
 * here exactly as it is in the plugin, then the generated declarations go
 * through the reference check. No CSS is parsed on the way: this is the path
 * the browser runtime takes too. */
export function generateThemeCss(theme?: Record<string, any>, references: ReferenceOptions = {}): string {
  const effective = resolveTheme(theme);
  const validated = validateTheme(effective, { references: false });
  if (!validated.ok) throw themeValidationError(validated.errors);

  const { css, declarations } = renderTheme(effective);
  enforceDeclarationReferences(declarations, references);
  return css;
}
