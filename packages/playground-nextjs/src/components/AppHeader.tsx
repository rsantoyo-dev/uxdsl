'use client'

import Link from 'next/link'
import { Sun, Moon, Github, Package } from 'lucide-react'
import { UXDSLLogo } from '@/components/UXDSLLogo'
import { useTheme } from '@/components/ThemeContext'
import { GITHUB_URL, NPM_URL } from '@/lib/docs'

// Inlined by next.config.js from packages/uxdsl/package.json: the version these pages document.
const VERSION = process.env.UXDSL_VERSION || ''

const THEMES = [
  { name: 'default', title: 'Default theme (purple)' },
  { name: 'green', title: 'Green theme' },
  { name: 'slate', title: 'Slate theme' },
] as const

export default function AppHeader() {
  const { isDark, currentTheme, customThemeName, switchTheme, toggleDarkMode } = useTheme()

  return (
    <header id="AppHeader" className="app-header">
      <div className="app-header__container">
        <div className="app-header__brand">
          <Link href="/" className="app-header__home" aria-label="UXDSL home">
            <UXDSLLogo className="app-header__logo-img" />
            <span className="app-header__title-text">UXDSL</span>
          </Link>
          {VERSION && (
            <a className="app-header__version" href={`${NPM_URL}/v/${VERSION}`} target="_blank" rel="noopener noreferrer" title={`The documentation describes uxdsl ${VERSION}`}>
              v{VERSION}
            </a>
          )}
        </div>

        <nav className="app-header__links" aria-label="Site">
          <Link href="/docs/introduction" className="app-header__link">Docs</Link>
          <a href={GITHUB_URL} className="app-header__link" target="_blank" rel="noopener noreferrer" aria-label="UXDSL on GitHub">
            <Github size={18} aria-hidden="true" />
            <span className="app-header__link-label">GitHub</span>
          </a>
          <a href={NPM_URL} className="app-header__link" target="_blank" rel="noopener noreferrer" aria-label="uxdsl on npm">
            <Package size={18} aria-hidden="true" />
            <span className="app-header__link-label">npm</span>
          </a>
        </nav>

        <div className="app-header__settings">
          <div className="app-header__themes" role="group" aria-label="Site theme">
            {THEMES.map(({ name, title }) => (
              <button
                key={name}
                type="button"
                onClick={() => switchTheme(name)}
                title={title}
                aria-label={title}
                aria-pressed={currentTheme === name}
                className={`theme-color-btn theme-color-btn--${name} ${currentTheme === name ? 'is-active' : ''}`}
              />
            ))}
            {customThemeName && (
              <button
                type="button"
                onClick={() => switchTheme('custom')}
                title={`Custom: ${customThemeName}`}
                aria-label={`Custom theme: ${customThemeName}`}
                aria-pressed={currentTheme === 'custom'}
                className={`theme-color-btn theme-color-btn--custom ${currentTheme === 'custom' ? 'is-active' : ''}`}
              />
            )}
          </div>
          <button type="button" className="theme-toggle" onClick={toggleDarkMode} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
            {isDark ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  )
}
