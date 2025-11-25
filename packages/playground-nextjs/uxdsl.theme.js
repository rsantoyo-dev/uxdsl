const fs = require('fs');
const path = require('path');

// Default Theme Definition - The "Library Defaults"
const DEFAULT_THEME = {
  breakpoints: { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 },
  palette: {
    primary: { main: '#3b82f6', contrast: '#ffffff', light: '#60a5fa', dark: '#2563eb' },
    secondary: { main: '#64748b', contrast: '#ffffff', light: '#94a3b8', dark: '#475569' },
    surface: { main: '#ffffff', contrast: '#0f172a', light: '#f8fafc', dark: '#1e293b' },
    neutral: { main: '#64748b', light: '#e2e8f0', dark: '#1e293b' }
  },
  spacing: {
    1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem',
    5: '1.25rem', 6: '1.5rem', 8: '2rem', 10: '2.5rem',
    12: '3rem', 13: '3.5rem', 14: '4rem', 15: '4.5rem', 16: '5rem'
  },
  densities: {
    1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem',
    5: '1.25rem', 6: '1.5rem', 7: '1.75rem', 8: '2rem',
    9: '2.25rem', 10: '2.5rem'
  }
};

function loadTheme() {
  try {
    const themePath = path.join(process.cwd(), 'uxdsl.theme.json');
    if (fs.existsSync(themePath)) {
      const content = fs.readFileSync(themePath, 'utf8');
      // If file is empty, return defaults
      if (!content || !content.trim() || content.trim() === '{}') {
        console.log('uxdsl.theme.json is empty, using default theme.');
        return DEFAULT_THEME;
      }
      
      const userTheme = JSON.parse(content);
      
      // Deep merge or shallow merge? For now, shallow merge top-level keys
      // This allows user to override just 'palette' but keep default 'spacing' if they want (logic can be improved)
      return {
        ...DEFAULT_THEME,
        ...userTheme,
        // Ensure nested objects are merged if they exist in both
        palette: { ...DEFAULT_THEME.palette, ...(userTheme.palette || {}) },
        spacing: { ...DEFAULT_THEME.spacing, ...(userTheme.spacing || {}) },
        densities: { ...DEFAULT_THEME.densities, ...(userTheme.densities || {}) },
        breakpoints: { ...DEFAULT_THEME.breakpoints, ...(userTheme.breakpoints || {}) }
      };
    }
  } catch (e) {
    console.warn('Failed to load uxdsl.theme.json, using defaults', e);
  }
  return DEFAULT_THEME;
}

module.exports = loadTheme();
