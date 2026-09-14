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

  // Color scales (for color(token) -> --ds__color__token)
  if (theme.colors) {
    Object.entries(theme.colors).forEach(([key, val]) => {
      if (typeof val === 'object' && val !== null) {
        Object.entries(val).forEach(([subKey, subVal]) => {
          cssVars.push(`--ds__color__${key}-${subKey}: ${subVal}`);
        });
      } else {
        cssVars.push(`--ds__color__${key}: ${val}`);
      }
    });
  }

  // Spacing
  if (theme.spacing) {
    Object.entries(theme.spacing).forEach(([key, val]) => {
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
