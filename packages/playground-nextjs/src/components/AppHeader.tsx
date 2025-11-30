'use client'

import { useState, useEffect } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { UXDSLLogo } from '@/components/UXDSLLogo'
import { generateThemeCss } from 'postcss-uxdsl/ds-runtime'
import greenTheme from '../../uxdsl.theme.green.json'
import purpleTheme from '../../uxdsl.theme.purple.json'
import defaultTheme from '../../uxdsl.theme.default.json'

export default function AppHeader() {
  const [isDark, setIsDark] = useState(false)
  const [currentTheme, setCurrentTheme] = useState<'default' | 'green' | 'purple'>('green')

  useEffect(() => {
    // Check initial preference
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark' || 
                       (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    setIsDark(isDarkMode)
  }, [])

  const switchTheme = (themeName: 'default' | 'green' | 'purple') => {
    let theme;
    switch (themeName) {
      case 'purple': theme = purpleTheme; break;
      case 'default': theme = defaultTheme; break;
      case 'green': default: theme = greenTheme; break;
    }
    
    const css = generateThemeCss(theme)
    const styleTag = document.getElementById('uxdsl-ssr-theme')
    if (styleTag) {
      styleTag.innerHTML = css
    }
    setCurrentTheme(themeName)
  }

  const toggleTheme = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    if (newIsDark) {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.setAttribute('data-theme', 'light')
    }
  }

  return (
    <header id="AppHeader">
      <div className="app-header__container">
        <div className="app-header__inner">
          <UXDSLLogo className="app-header__logo-img" />
          <div className="app-header__title-text">UX-DSL</div>
        </div>
        
        <div className="app-header__actions">
          <div className="app-header__settings">
            <button 
              onClick={() => switchTheme('default')}
              title="Default (Slate) Theme"
              className={`theme-color-btn ${currentTheme === 'default' ? 'is-active' : ''}`}
              style={{ '--theme-color': '#2C415C' } as React.CSSProperties}
            />
            <button 
              onClick={() => switchTheme('green')}
              title="Green Theme"
              className={`theme-color-btn ${currentTheme === 'green' ? 'is-active' : ''}`}
              style={{ '--theme-color': '#15803D' } as React.CSSProperties}
            />
            <button 
              onClick={() => switchTheme('purple')}
              title="Purple Theme"
              className={`theme-color-btn ${currentTheme === 'purple' ? 'is-active' : ''}`}
              style={{ '--theme-color': '#7b1fa2' } as React.CSSProperties}
            />

            <div className="divider-vertical" />

            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
              {isDark ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}