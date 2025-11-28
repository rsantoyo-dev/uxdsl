'use client'

import { useState, useEffect } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useBreakpoints, BreakpointKey } from '@/components/BreakpointsProvider'
import { UXDSLLogo } from '@/components/UXDSLLogo'
import { generateThemeCss } from 'postcss-uxdsl/ds-runtime'
import greenTheme from '../../uxdsl.theme.green.json'
import purpleTheme from '../../uxdsl.theme.purple.json'
import defaultTheme from '../../uxdsl.theme.default.json'

export default function AppHeader() {
  const [isDark, setIsDark] = useState(false)
  const { breakpoints } = useBreakpoints()
  const [activeBp, setActiveBp] = useState<string>('xs')
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

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth
      
      // Calculate active breakpoint
      const keys = Object.keys(breakpoints) as BreakpointKey[]
      keys.sort((a, b) => breakpoints[a] - breakpoints[b])
      
      let current = 'xs'
      for (const key of keys) {
        if (w >= breakpoints[key]) {
          current = key
        }
      }
      setActiveBp(current)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoints])

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
    <header className="app-header">
      <div className="app-header__container">
        <div className="app-header__inner">
          <UXDSLLogo className="app-header__logo-img" />
          <div className="app-header__title-text">UX-DSL</div>
        </div>
        
        <div className="app-header__actions">
          {/* Breakpoint Monitor Badge */}
          <div className="bp-monitor" title={`Active Breakpoint: ${activeBp}`}>
            <Monitor size={14} className="bp-monitor__icon" />
            <span className="bp-monitor__label">{activeBp.toUpperCase()}</span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', margin: '0 1rem', alignItems: 'center' }}>
            <button 
              onClick={() => switchTheme('default')}
              title="Default (Slate) Theme"
              style={{ 
                width: '1.25rem', 
                height: '1.25rem', 
                borderRadius: '50%', 
                background: '#2C415C', 
                border: currentTheme === 'default' ? '2px solid var(--ds__palette__surface-contrast)' : '2px solid transparent',
                cursor: 'pointer',
                padding: 0
              }}
            />
            <button 
              onClick={() => switchTheme('green')}
              title="Green Theme"
              style={{ 
                width: '1.25rem', 
                height: '1.25rem', 
                borderRadius: '50%', 
                background: '#15803D', 
                border: currentTheme === 'green' ? '2px solid var(--ds__palette__surface-contrast)' : '2px solid transparent',
                cursor: 'pointer',
                padding: 0
              }}
            />
            <button 
              onClick={() => switchTheme('purple')}
              title="Purple Theme"
              style={{ 
                width: '1.25rem', 
                height: '1.25rem', 
                borderRadius: '50%', 
                background: '#7b1fa2', 
                border: currentTheme === 'purple' ? '2px solid var(--ds__palette__surface-contrast)' : '2px solid transparent',
                cursor: 'pointer',
                padding: 0
              }}
            />
          </div>

          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {isDark ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </div>
    </header>
  )
}