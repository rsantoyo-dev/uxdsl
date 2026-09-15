import { DEFAULT_BORDER_COLORS } from './edges';
import { normalizeSpacingDefinitions } from './language';

/** Canonical JSON -> CSS mapping for foundational values and Palette modes. */
export function generateFoundationCss(theme: Record<string, any>): string {
  const cssVars: string[] = [];

  // Palette
  if (theme.palette) {
    Object.entries(theme.palette).forEach(([key, val]) => {
      if (typeof val === 'object' && val !== null) {
        Object.entries(val).forEach(([subKey, subVal]) => {
          cssVars.push(`--ds__palette__${key}-${subKey}: ${subVal}`);
        });
      } else {
        cssVars.push(`--ds__palette__${key}: ${val}`);
      }
    });
  }

  // Color scales (for color(token) -> --ds__color__token). DEFAULT_BORDERS
  // (edges.ts) depends on color(gray.*); merge that dependency in here —
  // under the theme's own gray shades when given — so border(1..5) resolves
  // out of the box. A theme that overrides every DEFAULT_BORDERS key no
  // longer references gray and this merge goes unused.
  const colors = { ...theme.colors, gray: { ...DEFAULT_BORDER_COLORS.gray, ...theme.colors?.gray } };
  Object.entries(colors).forEach(([key, val]) => {
    if (typeof val === 'object' && val !== null) {
      Object.entries(val).forEach(([subKey, subVal]) => {
        cssVars.push(`--ds__color__${key}-${subKey}: ${subVal}`);
      });
    } else {
      cssVars.push(`--ds__color__${key}: ${val}`);
    }
  });

  // Spacing. MIG-01: "space-1" and "1" both mean --space-1; normalize
  // before emission so neither form silently doubles the prefix or lets
  // one spelling win by accidental object key order.
  if (theme.spacing) {
    Object.entries(normalizeSpacingDefinitions(theme.spacing)).forEach(([key, val]) => {
      cssVars.push(`--space-${key}: ${val}`);
    });
  }

  let cssContent = `:root { ${cssVars.join('; ')}; }`;
  // Dark Mode
  if (theme.modes && theme.modes.dark && theme.modes.dark.palette) {
    const darkVars: string[] = [];
    Object.entries(theme.modes.dark.palette).forEach(([key, val]) => {
      if (typeof val === 'object' && val !== null) {
        Object.entries(val).forEach(([subKey, subVal]) => {
          darkVars.push(`--ds__palette__${key}-${subKey}: ${subVal}`);
        });
      } else {
        darkVars.push(`--ds__palette__${key}: ${val}`);
      }
    });
    
    if (darkVars.length > 0) {
      const darkCss = darkVars.join('; ');
      cssContent += ` @media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ${darkCss}; } }`;
      cssContent += ` :root[data-theme='dark'] { ${darkCss}; }`;
    }
  }

  return cssContent;
}
