import { generateFoundationCss } from '../foundations';
import { generateInputCss } from '../inputs';
import { generateButtonCss } from '../buttons';
import { generateSurfaceCss } from '../surfaces';
import { generateShadowCss } from '../shadows';
import { generateEdgeCss } from '../edges';
import { DEFAULT_BREAKPOINTS, generateDensityCss, getDensityTokens } from '../language';
import { generateTypographyCss } from '../typography';
import postcss, { Declaration } from 'postcss';
import { enforceReferences, ReferenceOptions } from '../reference-integrity';
import { resolveTheme } from '../default-theme';

/** MIG-B2-02: omitted/partial themes resolve against `DEFAULT_THEME`
 * before generating or validating — `generateThemeCss()` with no
 * arguments at all now produces valid CSS instead of an empty string. */
export function generateThemeCss(theme?: Record<string, any>, references: ReferenceOptions = {}): string {
  theme = resolveTheme(theme);

  // Density references and responsive rules are compiled by the shared engine.

  let cssContent = generateFoundationCss(theme);
  cssContent += '\n' + generateTypographyCss(theme);
  cssContent += '\n' + generateEdgeCss(theme);
  cssContent += '\n' + generateShadowCss(theme);
  cssContent += '\n' + generateSurfaceCss(theme);
  cssContent += '\n' + generateButtonCss(theme);
  cssContent += '\n' + generateInputCss(theme);
  cssContent += '\n' + generateDensityCss(getDensityTokens(theme), { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints });


  const root = postcss.parse(cssContent);
  const declarations: Declaration[] = [];
  root.walkDecls(node => { declarations.push(node); });
  enforceReferences(root, declarations, references);
  return cssContent;
}
