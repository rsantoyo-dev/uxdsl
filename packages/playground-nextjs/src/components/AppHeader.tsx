'use client'

import { useState, useEffect } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useBreakpoints, BreakpointKey } from '@/components/BreakpointsProvider'
import { UXDSLLogo } from '@/components/UXDSLLogo'

export default function AppHeader() {
  const [isDark, setIsDark] = useState(false)
  const { breakpoints } = useBreakpoints()
  const [activeBp, setActiveBp] = useState<string>('xs')

  useEffect(() => {
    // Check initial preference
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark' || 
                       (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    setIsDark(isDarkMode)
  }, [])

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

          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {isDark ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </div>
    </header>
  )
}