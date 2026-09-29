'use client'


import styles from './AppHeader.module.css'
import { scopedClasses } from '../lib/uxdsl-module-classes'
import Link from 'next/link'
import { Sun, Moon } from 'lucide-react'
import { UXDSLLogo } from '@/components/UXDSLLogo'
import { useTheme } from '@/components/ThemeContext'

export default function AppHeader() {
  const { isDark, currentTheme, customThemeName, switchTheme, toggleDarkMode } = useTheme()

  return (
    <header id="AppHeader" className={scopedClasses('module-root', styles)}>
      <div className={scopedClasses("app-header__container", styles)}>
        <Link href="/" className={scopedClasses("app-header__inner", styles)}>
          <UXDSLLogo className={scopedClasses("app-header__logo-img", styles)} />
          <div className={scopedClasses("app-header__title-text", styles)}>UX-DSL</div>
        </Link>
        
        <div className={scopedClasses("app-header__actions", styles)}>
          <div className={scopedClasses("app-header__settings", styles)}>
            <button 
              onClick={() => switchTheme('default')}
              title="Default (Purple) Theme"
              className={scopedClasses(`theme-color-btn theme-color-btn--default ${currentTheme === 'default' ? 'is-active' : ''}`, styles)}
            />
            <button 
              onClick={() => switchTheme('green')}
              title="Green Theme"
              className={scopedClasses(`theme-color-btn theme-color-btn--green ${currentTheme === 'green' ? 'is-active' : ''}`, styles)}
            />
            <button 
              onClick={() => switchTheme('slate')}
              title="Slate Theme (Classic)"
              className={scopedClasses(`theme-color-btn theme-color-btn--slate ${currentTheme === 'slate' ? 'is-active' : ''}`, styles)}
            />

            {customThemeName && (
              <button 
                onClick={() => switchTheme('custom')}
                title={`Custom: ${customThemeName}`}
                className={scopedClasses(`theme-color-btn ${currentTheme === 'custom' ? 'is-active' : ''}`, styles)}
                style={{ 
                  '--theme-color': 'transparent',
                  background: 'linear-gradient(135deg, #FF0080, #7928CA)',
                  border: 'none' 
                } as React.CSSProperties}
              />
            )}

            <div className={scopedClasses("divider-vertical", styles)} />

            <button className={scopedClasses("theme-toggle", styles)} onClick={toggleDarkMode} aria-label="Toggle theme">
              {isDark ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}