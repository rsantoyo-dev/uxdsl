'use client'

import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { deepMergeTheme, generateThemeCss, validateAndNormalizeTheme } from 'postcss-uxdsl/ds-runtime'
import { baseTheme, themes } from '../../themes'

const { default: defaultTheme, green: greenTheme, purple: purpleTheme, slate: slateTheme } = themes

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
  setCustomTheme: (name: string, themeData: any, options?: { replace?: boolean }) => void
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
  const lastFontsHrefRef = useRef<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastValidThemeRef = useRef<any>(null)

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

    // Validate + normalize theme input so invalid JSON can't silently break styling.
    const validated = validateAndNormalizeTheme(theme, { requireXsForResponsive: true })
    if (!validated.ok) {
      // Keep the last known good theme applied.
      // eslint-disable-next-line no-console
      console.error('UXDSL theme rejected (validation failed):', {
        errors: validated.errors,
        warnings: validated.warnings,
      })

      if (lastValidThemeRef.current) {
        theme = lastValidThemeRef.current
      } else {
        return
      }
    } else {
      theme = validated.theme

      if (validated.warnings.length > 0) {
        // eslint-disable-next-line no-console
        console.warn('UXDSL theme warnings:', validated.warnings)
      }
    }

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

    // Shared engine owns typography generation; this provider only applies theme state.
    const baseSignature = stableStringify(theme)
    if (baseSignature && baseSignature !== lastBaseSignatureRef.current) {
      let css: string
      try {
        css = generateThemeCss(theme)
      } catch (error) {
        console.error('UXDSL theme generation failed; keeping the applied theme', error)
        return
      }
      ensureStyleTag('uxdsl-ssr-theme').textContent = css
      lastValidThemeRef.current = theme
      document.getElementById('uxdsl-typography-theme')?.remove()
      document.getElementById('uxdsl-typo-overrides')?.remove()
      lastBaseSignatureRef.current = baseSignature
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
  const setCustomTheme = (name: string, themeData: any, options?: { replace?: boolean }) => {
    // Edits layer over the active theme; replace resets overrides to the common base.
    const base = options?.replace ? baseTheme : (activeThemeData || defaultTheme)
    const merged = deepMergeTheme(base, themeData || {})

    const checked = validateAndNormalizeTheme(merged)
    if (!checked.ok) throw new Error(checked.errors.map(issue => `${issue.path}: ${issue.message}`).join('; '))
    generateThemeCss(merged) // Validate the exact source used by the compiler and inspector.
    setCustomThemeData(merged)
    setCustomThemeName(name)
    
    if (themeData?.backgroundImage) {
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
