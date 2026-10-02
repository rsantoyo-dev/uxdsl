import { generateFoundationCss } from '../foundations';
import { generateInputCss } from '../inputs';
import { generateButtonCss } from '../buttons';
import { generateSurfaceCss } from '../surfaces';
import { generateShadowCss } from '../shadows';
import { generateEdgeCss } from '../edges';
import { BreakpointMap, DEFAULT_BREAKPOINTS, generateDensityCss, getDensityTokens } from '../language';
import { generateTypographyCss } from '../typography';
import postcss, { Declaration } from 'postcss';
import { enforceReferences, ReferenceOptions } from '../reference-integrity';
import { resolveTheme } from '../default-theme';
import { googleFontsImportUrls } from '../fonts';
import { validateTheme, themeValidationError } from './theme-validate';

/**
 * The theme stylesheet for an *effective* theme, as a string: every `@import`
 * first, then one `:root` block per family and breakpoint. Pure and
 * unvalidated — the PostCSS plugin and `generateThemeCss` both emit exactly
 * this (stability phase 1, audit finding T1), after validating the theme
 * through `validateTheme`. Callers that already validated may call this
 * directly; anything else goes through `generateThemeCss`.
 */
export function renderThemeCss(theme: Record<string, any>, breakpoints: BreakpointMap = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }): string {
  // MIG-B6-29 phase 4: the same shared encoder the PostCSS plugin uses, so a
  // runtime/SSR consumer of this function gets the identical `@import` a
  // build-time compile of the same theme would. `@import` rules must lead
  // the stylesheet, before any other rule.
  let cssContent = googleFontsImportUrls(theme.fonts?.google)
    .map((url) => `@import url('${url}');`)
    .join('\n');
  if (cssContent) cssContent += '\n';
  cssContent += generateFoundationCss(theme);
  cssContent += '\n' + generateTypographyCss(theme, breakpoints);
  cssContent += '\n' + generateEdgeCss(theme, breakpoints);
  cssContent += '\n' + generateShadowCss(theme, breakpoints);
  cssContent += '\n' + generateSurfaceCss(theme, breakpoints);
  cssContent += '\n' + generateButtonCss(theme, breakpoints);
  cssContent += '\n' + generateInputCss(theme, breakpoints);
  cssContent += '\n' + generateDensityCss(getDensityTokens(theme), breakpoints);
  return cssContent;
}

/** MIG-B2-02: omitted/partial themes resolve against `DEFAULT_THEME`
 * before generating or validating — `generateThemeCss()` with no
 * arguments at all now produces valid CSS instead of an empty string.
 *
 * Stability phase 1: the effective theme goes through `validateTheme` first
 * (structure, breakpoints, engines), so a numeric leaf or a `"768"` breakpoint
 * is an error here exactly as it is in the plugin, then through the reference
 * check of the generated stylesheet. */
export function generateThemeCss(theme?: Record<string, any>, references: ReferenceOptions = {}): string {
  const effective = resolveTheme(theme);
  const validated = validateTheme(effective, { references: false });
  if (!validated.ok) throw themeValidationError(validated.errors);

  const cssContent = renderThemeCss(effective);
  const root = postcss.parse(cssContent);
  const declarations: Declaration[] = [];
  root.walkDecls(node => { declarations.push(node); });
  enforceReferences(root, declarations, references);
  return cssContent;
}
