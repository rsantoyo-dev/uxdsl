'use client'

import { useNav } from '@/components/NavContext'
import { Menu, Sun, Moon } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useBreakpoints } from '@/components/BreakpointsProvider'
import { useState, useEffect, Fragment } from 'react'
import Link from 'next/link'
import { useTheme } from '@/components/ThemeContext'

const MINI_THEMES = [
  { name: 'default', title: 'Default theme' },
  { name: 'green', title: 'Green theme' },
  { name: 'slate', title: 'Slate theme' },
] as const

export default function PageToolbar() {
  const { toggle } = useNav()
  const pathname = usePathname()
  const { breakpoints } = useBreakpoints()
  const [activeBp, setActiveBp] = useState<string>('xs')
  const [windowWidth, setWindowWidth] = useState(0)
  const [showControls, setShowControls] = useState(false)

  const { isDark, currentTheme, switchTheme, toggleDarkMode } = useTheme()

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth
      setWindowWidth(w)

      const entries = Object.entries(breakpoints)
      entries.sort((a, b) => (a[1] as number) - (b[1] as number))

      let current = entries[0]?.[0] ?? 'xs'
      for (const [key, value] of entries) {
        if (w >= (value as number)) {
          current = key
        }
      }
      setActiveBp(current)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoints])

  useEffect(() => {
    const header = document.getElementById('AppHeader')
    if (!header) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show the theme controls once the header (which has the full ones) scrolls out.
        setShowControls(!entry.isIntersecting)
      },
      { threshold: 0 }
    )

    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  const isDocs = pathname.startsWith('/docs')
  const segments = pathname.split('/').filter(Boolean)
  const threshold = breakpoints[activeBp] ?? 0
  const explanation = `This window is ${windowWidth}px wide, so the theme's ${activeBp} breakpoint (from ${threshold}px) is the one whose rules apply. The thresholds are defined in the theme JSON.`

  return (
    <div id="PageToolbar" className="page-toolbar">
      <div className="page-toolbar__inner">
        <div className="page-toolbar__left">
          {isDocs && (
            <button
              type="button"
              className="page-toolbar__burger"
              onClick={toggle}
              aria-label="Open the documentation menu"
            >
              <Menu size={18} aria-hidden="true" />
            </button>
          )}
          <nav className="page-toolbar__title" aria-label="Breadcrumb">
            <Link href="/" className="breadcrumb-link-brand">
              <span className="page-toolbar__brand-text">UXDSL</span>
            </Link>
            {segments.map((segment, index) => {
              const href = segment === 'docs' ? '/docs/introduction' : '/' + segments.slice(0, index + 1).join('/')
              return (
                <Fragment key={segment}>
                  <span className="breadcrumb-separator" aria-hidden="true">/</span>
                  <Link href={href} className="breadcrumb-link" aria-current={index === segments.length - 1 ? 'page' : undefined}>
                    {segment}
                  </Link>
                </Fragment>
              )
            })}
          </nav>
        </div>

        <div className="page-toolbar__right">
          <div className={`page-toolbar__theme-row ${showControls ? 'is-visible' : ''}`}>
            {MINI_THEMES.map(({ name, title }) => (
              <button
                key={name}
                type="button"
                onClick={() => switchTheme(name)}
                className={`mini-theme-btn mini-theme-btn--${name} ${currentTheme === name ? 'is-active' : ''}`}
                title={title}
                aria-label={title}
                aria-pressed={currentTheme === name}
              />
            ))}
            <button type="button" onClick={toggleDarkMode} className="mini-theme-toggle" aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
              {isDark ? <Moon size={14} aria-hidden="true" /> : <Sun size={14} aria-hidden="true" />}
            </button>
          </div>
          <Link href="/docs/breakpoints" className="page-toolbar__viewport" title={explanation} aria-label={explanation}>
            <span className="page-toolbar__viewport-label">viewport</span>
            <span className="page-toolbar__width">{windowWidth}px</span>
            <span className="page-toolbar__bp">{activeBp} ≥ {threshold}px</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
