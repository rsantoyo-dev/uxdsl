'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { generateThemeCss } from 'postcss-uxdsl/ds-runtime'
import greenTheme from '../../uxdsl.theme.green.json'
import purpleTheme from '../../uxdsl.theme.purple.json'
import defaultTheme from '../../uxdsl.theme.default.json'

type ThemeName = 'default' | 'green' | 'purple'

interface ThemeContextType {
  isDark: boolean
  currentTheme: ThemeName
  switchTheme: (theme: ThemeName) => void
  toggleDarkMode: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeContextProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false)
  const [currentTheme, setCurrentTheme] = useState<ThemeName>('default')

  useEffect(() => {
    // Check initial preference
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark' || 
                       (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    setIsDark(isDarkMode)
  }, [])

  const switchTheme = (themeName: ThemeName) => {
    let theme;
    switch (themeName) {
      case 'purple': theme = purpleTheme; break;
      case 'green': theme = greenTheme; break;
      case 'default': default: theme = defaultTheme; break;
    }
    
    const css = generateThemeCss(theme)
    const styleTag = document.getElementById('uxdsl-ssr-theme')
    if (styleTag) {
      styleTag.innerHTML = css
    }
    setCurrentTheme(themeName)
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
    <ThemeContext.Provider value={{ isDark, currentTheme, switchTheme, toggleDarkMode }}>
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
