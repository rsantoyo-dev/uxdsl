'use client'

import Link from 'next/link'
import { Sun, Moon } from 'lucide-react'
import { UXDSLLogo } from '@/components/UXDSLLogo'
import { useTheme } from '@/components/ThemeContext'

export default function AppHeader() {
  const { isDark, currentTheme, customThemeName, switchTheme, toggleDarkMode } = useTheme()

  return (
    <header id="AppHeader">
      <div className="app-header__container">
        <Link href="/" className="app-header__inner">
          <UXDSLLogo className="app-header__logo-img" />
          <div className="app-header__title-text">UX-DSL</div>
        </Link>
        
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

            {customThemeName && (
              <button 
                onClick={() => switchTheme('custom')}
                title={`Custom: ${customThemeName}`}
                className={`theme-color-btn ${currentTheme === 'custom' ? 'is-active' : ''}`}
                style={{ 
                  '--theme-color': 'transparent',
                  background: 'linear-gradient(135deg, #FF0080, #7928CA)',
                  border: 'none' 
                } as React.CSSProperties}
              />
            )}

            <div className="divider-vertical" />

            <button className="theme-toggle" onClick={toggleDarkMode} aria-label="Toggle theme">
              {isDark ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}