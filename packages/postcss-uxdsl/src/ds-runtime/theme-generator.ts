export function generateThemeCss(theme: Record<string, any>): string {
  if (!theme) return '';
  
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

  // Spacing
  if (theme.spacing) {
    Object.entries(theme.spacing).forEach(([key, val]) => {
      cssVars.push(`--space-${key}: ${val}`);
    });
  }

  // Densities
  if (theme.densities) {
    Object.entries(theme.densities).forEach(([key, val]) => {
      cssVars.push(`--density-${key}: ${val}`);
    });
  }

  // Radii
  if (theme.radii) {
    Object.entries(theme.radii).forEach(([key, val]) => {
      cssVars.push(`--radius-${key}: ${val}`);
    });
  }

  // Shadows
  if (theme.shadows) {
    Object.entries(theme.shadows).forEach(([key, val]) => {
      cssVars.push(`--shadow-${key}: ${val}`);
    });
  }

  // Borders
  if (theme.borders) {
    Object.entries(theme.borders).forEach(([key, val]) => {
      cssVars.push(`--border-${key}: ${val}`);
    });
  }

  // Typography
  if (theme.typography) {
    Object.entries(theme.typography).forEach(([key, val]) => {
      cssVars.push(`--${key}: ${val}`);
    });
  }

  let cssContent = `:root { ${cssVars.join('; ')} }`;

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
      cssContent += ` @media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ${darkCss} } }`;
      cssContent += ` :root[data-theme='dark'] { ${darkCss} }`;
    }
  }

  return cssContent;
}
