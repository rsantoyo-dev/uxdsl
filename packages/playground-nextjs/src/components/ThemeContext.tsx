'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { generateThemeCss } from 'postcss-uxdsl/ds-runtime'
import greenTheme from '../../uxdsl.theme.green.json'
import purpleTheme from '../../uxdsl.theme.purple.json'
import defaultTheme from '../../uxdsl.theme.default.json'
import slateTheme from '../../uxdsl.theme.slate.json'

export type ThemeName = 'default' | 'green' | 'purple' | 'slate' | 'custom'

interface ThemeContextType {
  isDark: boolean
  currentTheme: ThemeName
  customThemeName: string | null
  backgroundImage: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeThemeData: any
  switchTheme: (theme: ThemeName) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setCustomTheme: (name: string, themeData: any) => void
  toggleDarkMode: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeContextProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false)
  const [currentTheme, setCurrentTheme] = useState<ThemeName>('default')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [customThemeData, setCustomThemeData] = useState<any>(null)
  const [customThemeName, setCustomThemeName] = useState<string | null>(null)
  const [backgroundImage, setBackgroundImage] = useState<string | null>('abstract purple curves')

  const activeThemeData = React.useMemo(() => {
    switch (currentTheme) {
      case 'purple': return purpleTheme; // Same as default now (optional redundancy)
      case 'green': return greenTheme;
      case 'slate': return slateTheme;
      case 'custom': return customThemeData || defaultTheme;
      case 'default': default: return defaultTheme;
    }
  }, [currentTheme, customThemeData]);

  useEffect(() => {
    // Check initial preference
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark' || 
                       (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    setIsDark(isDarkMode)
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyThemeEffects = (theme: any) => {
    if (!theme) return

    // Clear any manual overrides from the Typography Playground
    const root = document.documentElement;
    const tags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'body', 'caption', 'small', 'code', 'pre'];
    const props = ['font-family', 'weight', 'size', 'line', 'spacing', 'opacity'];
    
    tags.forEach(tag => {
      props.forEach(prop => {
        root.style.removeProperty(`--${tag}-${prop}`);
      });
    });
    
    // Also clear global font families just in case
    root.style.removeProperty('--font-ui');
    root.style.removeProperty('--font-ui-2');
    root.style.removeProperty('--font-code');

    // 1. Generate Base CSS from tokens
    let css = generateThemeCss(theme)

    // 2. Handle Font Families (not covered by standard generator yet)
    if (theme.fonts?.families) {
      const fontVars = []
      for (const fontKey in theme.fonts.families) {
        fontVars.push(`--font-${fontKey}: ${theme.fonts.families[fontKey]}`)
      }
      if (fontVars.length > 0) {
        // Append to :root block (hacky string injection, but works for now)
        // effectively we just append another :root block
        css += ` :root { ${fontVars.join('; ')} }`
      }
    }

    // 2.5 Handle Typography Details (line-height, letter-spacing, size, weight)
    if (theme.typography_details) {
      const responsiveVars: Record<string, string[]> = {
        xs: [], sm: [], md: [], lg: [], xl: []
      };

      const parseResponsiveValue = (value: string) => {
        const breakpoints: Record<string, string> = {};
        const regex = /(xs|sm|md|lg|xl)\(([^)]+)\)/g;
        let match;
        let hasMatches = false;
        
        while ((match = regex.exec(value)) !== null) {
          hasMatches = true;
          breakpoints[match[1]] = match[2];
        }
        
        if (!hasMatches) {
          return { xs: value }; // Treat as base value if no responsive syntax
        }
        return breakpoints;
      };

      const defaultDetails = theme.typography_details.default || {};

      for (const tag in theme.typography_details) {
        const details = theme.typography_details[tag]
        const isDefaultTag = tag === 'default';
        
        const processProp = (propName: string, cssVarSuffix: string) => {
          // Use explicit value OR fallback to default (if not default tag)
          const value = details[propName] || (!isDefaultTag ? defaultDetails[propName] : undefined);

          if (value) {
            const parsed = parseResponsiveValue(value);
            Object.entries(parsed).forEach(([bp, val]) => {
               if (responsiveVars[bp]) {
                 responsiveVars[bp].push(`--${tag}-${cssVarSuffix}: ${val}`);
               }
            });
          }
        };

        processProp('lineHeight', 'line');
        processProp('letterSpacing', 'spacing');
        processProp('fontSize', 'size');
        processProp('fontWeight', 'weight');
        processProp('fontFamily', 'font-family');
        processProp('textTransform', 'transform');
        processProp('textDecoration', 'decoration');
        processProp('fontStyle', 'style');
        processProp('marginBlockStart', 'margin-block-start');
        processProp('marginBlockEnd', 'margin-block-end');
      }

      // Generate CSS for each breakpoint
      // Base (xs)
      if (responsiveVars.xs.length > 0) {
        css += ` :root { ${responsiveVars.xs.join('; ')} }`;
      }

      // Media queries
      const bpValues = theme.breakpoints || { sm: 480, md: 768, lg: 1024, xl: 1280 };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typedBpValues = bpValues as any;

      ['sm', 'md', 'lg', 'xl'].forEach(bp => {
        if (responsiveVars[bp] && responsiveVars[bp].length > 0) {
           const minWidth = typedBpValues[bp];
           if (minWidth) {
             css += ` @media (min-width: ${minWidth}px) { :root { ${responsiveVars[bp].join('; ')} } }`;
           }
        }
      });
    }

    // 2.6 Inject Global Consumption Rules for New Properties
    // We generate specific, high-specificity rules ONLY for properties that are explicitly defined in the theme.
    // This ensures we override component styles (like margin: 0) when the user wants to, 
    // but leave them alone if the user hasn't set a value.
    const consumptionTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'body', 'caption', 'small', 'code', 'pre'];
    let overrideCss = '';

    consumptionTags.forEach(tag => {
      const details = theme.typography_details?.[tag];
      const defaultDetails = theme.typography_details?.default || {};
      
      const getValue = (prop: string) => details?.[prop] || (tag !== 'default' ? defaultDetails?.[prop] : undefined);

      const propsMap = [
        { js: 'textTransform', css: 'text-transform', varSuffix: 'transform' },
        { js: 'textDecoration', css: 'text-decoration', varSuffix: 'decoration' },
        { js: 'fontStyle', css: 'font-style', varSuffix: 'style' },
        { js: 'marginBlockStart', css: 'margin-block-start', varSuffix: 'margin-block-start' },
        { js: 'marginBlockEnd', css: 'margin-block-end', varSuffix: 'margin-block-end' },
      ];

      const rules: string[] = [];
      propsMap.forEach(({ js, css, varSuffix }) => {
        if (getValue(js)) {
          // Use !important to ensure theme wins over component styles
          rules.push(`${css}: var(--${tag}-${varSuffix}) !important;`);
        }
      });

      if (rules.length > 0) {
        // Use :root prefix to boost specificity over simple classes
        overrideCss += `:root ${tag}, .ds-typo[data-typo="${tag}"] { ${rules.join(' ')} }\n`;
      }
    });
    
    css += `\n/* Global Typography Overrides */\n${overrideCss}`;

    // 3. Inject CSS
    const styleTag = document.getElementById('uxdsl-ssr-theme')
    if (styleTag) {
      styleTag.innerHTML = css
    }

    // 4. Handle Google Fonts Link
    if (theme.fonts?.google && Array.isArray(theme.fonts.google)) {
      const existingLink = document.getElementById('uxdsl-google-fonts')
      if (existingLink) {
        existingLink.remove()
      }

      const fontFamilies = theme.fonts.google.map((font: string) => font.replace(/ /g, '+')).join('&family=')
      if (fontFamilies) {
        const link = document.createElement('link')
        link.id = 'uxdsl-google-fonts'
        link.rel = 'stylesheet'
        link.href = `https://fonts.googleapis.com/css2?family=${fontFamilies}&display=swap`
        document.head.appendChild(link)
      }
    }
  }

  // Apply theme effects whenever activeThemeData changes
  useEffect(() => {
    if (activeThemeData) {
      applyThemeEffects(activeThemeData);
    }
  }, [activeThemeData]);

  const switchTheme = (themeName: ThemeName) => {
    let themeToApply;
    switch (themeName) {
      case 'purple': 
        themeToApply = purpleTheme; 
        setBackgroundImage('abstract purple curves');
        break;
      case 'green': 
        themeToApply = greenTheme; 
        setBackgroundImage('nature forest texture');
        break;
      case 'slate':
        themeToApply = slateTheme;
        setBackgroundImage('abstract geometric shapes');
        break;
      case 'purple':
        themeToApply = purpleTheme;
        setBackgroundImage('abstract purple curves');
        break;
      case 'custom': 
        themeToApply = customThemeData;
        // Background image for custom is already set in setCustomTheme
        // But if we are switching back to custom, we need to restore it
        if (customThemeData?.backgroundImage) {
          setBackgroundImage(customThemeData.backgroundImage);
        }
        break;
      case 'default': default: 
        themeToApply = defaultTheme; 
        setBackgroundImage('abstract purple curves'); // Default is now Purple-like
        break;
    }
    
    if (themeToApply) {
      setCurrentTheme(themeName)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setCustomTheme = (name: string, themeData: any) => {
    setCustomThemeData(themeData)
    setCustomThemeName(name)
    
    if (themeData.backgroundImage) {
      setBackgroundImage(themeData.backgroundImage)
    }

    // Automatically switch to it
    setCurrentTheme('custom')
  }

  const toggleDarkMode = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    if (newIsDark) {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.setAttribute('data-theme', 'light')
    }
  }

  return (
    <ThemeContext.Provider value={{ isDark, currentTheme, customThemeName, backgroundImage, activeThemeData, switchTheme, setCustomTheme, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeContextProvider')
  }
  return context
}
