'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { generateThemeCss } from 'postcss-uxdsl/ds-runtime'
import greenTheme from '../../uxdsl.theme.green.json'
import purpleTheme from '../../uxdsl.theme.purple.json'
import defaultTheme from '../../uxdsl.theme.default.json'

export type ThemeName = 'default' | 'green' | 'purple' | 'custom'

interface ThemeContextType {
  isDark: boolean
  currentTheme: ThemeName
  customThemeName: string | null
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

  useEffect(() => {
    // Check initial preference
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark' || 
                       (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    setIsDark(isDarkMode)
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyThemeEffects = (theme: any) => {
    if (!theme) return

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

  const switchTheme = (themeName: ThemeName) => {
    let themeToApply;
    switch (themeName) {
      case 'purple': themeToApply = purpleTheme; break;
      case 'green': themeToApply = greenTheme; break;
      case 'custom': themeToApply = customThemeData; break;
      case 'default': default: themeToApply = defaultTheme; break;
    }
    
    if (themeToApply) {
      applyThemeEffects(themeToApply)
      setCurrentTheme(themeName)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setCustomTheme = (name: string, themeData: any) => {
    setCustomThemeData(themeData)
    setCustomThemeName(name)
    // Automatically switch to it
    applyThemeEffects(themeData)
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
    <ThemeContext.Provider value={{ isDark, currentTheme, customThemeName, switchTheme, setCustomTheme, toggleDarkMode }}>
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
