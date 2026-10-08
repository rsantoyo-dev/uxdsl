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

/** The generated theme, as blocks: the `@import`s, the foundations (one line),
 * then one run of blocks per family, in the order the stylesheet lists them. */
function themeParts(theme: Record<string, any>, breakpoints: BreakpointMap) {
  return {
    imports: googleFontsImportUrls(theme.fonts?.google).map((url) => `@import url('${url}');`),
    foundation: foundationBlocks(theme),
    families: [
      typographyBlocks(theme, breakpoints),
      responsiveBlocks(compileEdgeRules(theme, breakpoints)),
      responsiveBlocks(compileShadowRules(theme, breakpoints)),
      responsiveBlocks(compileSurfaceRules(theme, breakpoints)),
      responsiveBlocks(compileButtonRules(theme, breakpoints)),
      responsiveBlocks(compileInputRules(theme, breakpoints)),
      responsiveBlocks(compileDensityRules(getDensityTokens(theme), breakpoints, (value) => tokenValueToCss(value, theme))),
    ] as CssBlock[][],
  };
}

/**
 * The theme stylesheet of an *effective* theme, and its declarations as the
 * reference check reads them — both from the same blocks, so what is checked
 * is exactly what is written. Every `@import` comes first (CSS honors one only
 * before every other rule), then the foundations and one run per family.
 */
export function renderTheme(theme: Record<string, any>, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }): { css: string; declarations: ReferenceDeclaration[] } {
  const parts = themeParts(theme, breakpoints);
  let css = parts.imports.join('\n');
  if (css) css += '\n';
  css += serializeBlocks(parts.foundation, ' ');
  for (const family of parts.families) css += '\n' + serializeBlocks(family);
  return { css, declarations: blockDeclarations([parts.foundation, ...parts.families].reduce((all, blocks) => all.concat(blocks), [] as CssBlock[])) };
}

/**
 * The theme stylesheet for an *effective* theme, as a string. Pure and
 * unvalidated — the PostCSS plugin and `generateThemeCss` both emit exactly
 * this, after validating the theme through `validateTheme`. Callers that
 * already validated may call this directly; anything else goes through
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
