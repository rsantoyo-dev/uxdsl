'use client'

import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
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

  const lastBaseSignatureRef = useRef<string | null>(null)
  const lastTypographySignatureRef = useRef<string | null>(null)
  const lastFontsHrefRef = useRef<string | null>(null)

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

    const ensureStyleTag = (id: string) => {
      const existing = document.getElementById(id) as HTMLStyleElement | null
      if (existing) return existing
      const next = document.createElement('style')
      next.id = id
      document.head.appendChild(next)
      return next
    }

    const stableStringify = (value: unknown) => {
      try {
        return JSON.stringify(value)
      } catch {
        return null
      }
    }

    const buildFontsHref = (googleFonts: unknown) => {
      if (!Array.isArray(googleFonts)) return null
      const families = (googleFonts as Array<unknown>)
        .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
        .map((font) => font.replace(/ /g, '+'))
        .join('&family=')
      if (!families) return null
      return `https://fonts.googleapis.com/css2?family=${families}&display=swap`
    }

    // 1) Base theme CSS (postcss-uxdsl runtime generator). Treat as relatively expensive.
    const baseSignature = stableStringify({
      // Exclude frequently-edited typography + fonts so edits don't force a full CSS rebuild.
      ...theme,
      typography_details: undefined,
      fonts: undefined
    })

    if (baseSignature && baseSignature !== lastBaseSignatureRef.current) {
      const css = generateThemeCss(theme)
      const baseStyleTag = ensureStyleTag('uxdsl-ssr-theme')
      baseStyleTag.textContent = css
      lastBaseSignatureRef.current = baseSignature
    }

    // 2) Typography + font-family vars as a small, separate stylesheet.
    const typographySignature = stableStringify({
      typography_details: theme.typography_details || null,
      breakpoints: theme.breakpoints || null,
      fontFamilies: theme.fonts?.families || null
    })

    if (typographySignature && typographySignature !== lastTypographySignatureRef.current) {
      let typographyCss = ''

      // 2.1 Font families as CSS vars
      if (theme.fonts?.families && typeof theme.fonts.families === 'object') {
        const fontVars: string[] = []
        for (const fontKey in theme.fonts.families) {
          const v = theme.fonts.families[fontKey]
          if (typeof v === 'string' && v.trim().length > 0) {
            fontVars.push(`--font-${fontKey}: ${v}`)
          }
        }
        if (fontVars.length > 0) {
          typographyCss += `:root { ${fontVars.join('; ')} }\n`
        }
      }

      // 2.2 Typography responsive vars
      if (theme.typography_details && typeof theme.typography_details === 'object') {
        const responsiveVars: Record<string, string[]> = { xs: [], sm: [], md: [], lg: [], xl: [] }

        const parseResponsiveValue = (value: string) => {
          const breakpoints: Record<string, string> = {}
          const regex = /(xs|sm|md|lg|xl)\(([^)]+)\)/g
          let match
          let hasMatches = false

          while ((match = regex.exec(value)) !== null) {
            hasMatches = true
            breakpoints[match[1]] = match[2]
          }

          if (!hasMatches) return { xs: value }
          return breakpoints
        }

        const defaultDetails = theme.typography_details.default || {}

        for (const tag in theme.typography_details) {
          const details = theme.typography_details[tag]
          const isDefaultTag = tag === 'default'

          const processProp = (propName: string, cssVarSuffix: string) => {
            const rawValue = details?.[propName] || (!isDefaultTag ? defaultDetails?.[propName] : undefined)
            if (typeof rawValue !== 'string' || rawValue.trim().length === 0) return

            const parsed = parseResponsiveValue(rawValue)
            Object.entries(parsed).forEach(([bp, val]) => {
              if (responsiveVars[bp]) {
                responsiveVars[bp].push(`--${tag}-${cssVarSuffix}: ${String(val).trim()}`)
              }
            })
          }

          processProp('lineHeight', 'line')
          processProp('letterSpacing', 'spacing')
          processProp('fontSize', 'size')
          processProp('fontWeight', 'weight')
          processProp('fontFamily', 'font-family')
          processProp('textTransform', 'transform')
          processProp('textDecoration', 'decoration')
          processProp('fontStyle', 'style')
          processProp('marginBlockStart', 'margin-block-start')
          processProp('marginBlockEnd', 'margin-block-end')
        }

        if (responsiveVars.xs.length > 0) {
          typographyCss += `:root { ${responsiveVars.xs.join('; ')} }\n`
        }

        const bpValues = theme.breakpoints || { sm: 480, md: 768, lg: 1024, xl: 1280 }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const typedBpValues = bpValues as any
        ;['sm', 'md', 'lg', 'xl'].forEach((bp) => {
          if (responsiveVars[bp] && responsiveVars[bp].length > 0) {
            const minWidth = typedBpValues[bp]
            if (minWidth) {
              typographyCss += `@media (min-width: ${minWidth}px) { :root { ${responsiveVars[bp].join('; ')} } }\n`
            }
          }
        })

        // 2.3 Consumption overrides for properties that need higher specificity.
        const consumptionTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'body', 'caption', 'small', 'code', 'pre']
        let overrideCss = ''

        consumptionTags.forEach((tag) => {
          const details = theme.typography_details?.[tag]
          const fallbackDetails = theme.typography_details?.default || {}
          const getValue = (prop: string) => details?.[prop] || (tag !== 'default' ? fallbackDetails?.[prop] : undefined)

          const propsMap = [
            { js: 'textTransform', css: 'text-transform', varSuffix: 'transform' },
            { js: 'textDecoration', css: 'text-decoration', varSuffix: 'decoration' },
            { js: 'fontStyle', css: 'font-style', varSuffix: 'style' },
            { js: 'marginBlockStart', css: 'margin-block-start', varSuffix: 'margin-block-start' },
            { js: 'marginBlockEnd', css: 'margin-block-end', varSuffix: 'margin-block-end' }
          ]

          const rules: string[] = []
          propsMap.forEach(({ js, css, varSuffix }) => {
            if (getValue(js)) {
              rules.push(`${css}: var(--${tag}-${varSuffix}) !important;`)
            }
          })

          if (rules.length > 0) {
            overrideCss += `:root ${tag}, .ds-typo[data-typo="${tag}"] { ${rules.join(' ')} }\n`
          }
        })

        if (overrideCss.trim().length > 0) {
          typographyCss += `\n/* Global Typography Overrides */\n${overrideCss}`
        }
      }

      const typographyStyleTag = ensureStyleTag('uxdsl-typography-theme')
      typographyStyleTag.textContent = typographyCss
      lastTypographySignatureRef.current = typographySignature
    }

    // 3) Google fonts link - avoid churn if href is unchanged.
    const nextFontsHref = buildFontsHref(theme.fonts?.google)
    if (nextFontsHref !== lastFontsHrefRef.current) {
      const existingLink = document.getElementById('uxdsl-google-fonts') as HTMLLinkElement | null
      if (!nextFontsHref) {
        if (existingLink) existingLink.remove()
      } else {
        if (existingLink) {
          existingLink.href = nextFontsHref
        } else {
          const link = document.createElement('link')
          link.id = 'uxdsl-google-fonts'
          link.rel = 'stylesheet'
          link.href = nextFontsHref
          document.head.appendChild(link)
        }
      }
      lastFontsHrefRef.current = nextFontsHref
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
