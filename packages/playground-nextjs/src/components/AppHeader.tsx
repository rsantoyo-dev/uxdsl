'use client'

import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'

export default function AppHeader() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // Check initial preference
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark' || 
                       (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    setIsDark(isDarkMode)
  }, [])

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
          <h1 className="app-header__title">UXDSL</h1>
          <span className="app-header__subtitle">UX - design system language</span>
        </div>
        <div className="app-header__actions">
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {isDark ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </div>
    </header>
  )
}
