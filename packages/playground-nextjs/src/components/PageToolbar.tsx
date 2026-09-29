'use client'


import styles from './PageToolbar.module.css'
import { scopedClasses } from '../lib/uxdsl-module-classes'
import { useNav } from '@/components/NavContext'
import { Menu, Sun, Moon } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useBreakpoints } from '@/components/BreakpointsProvider'
import { useState, useEffect, Fragment } from 'react'
import Link from 'next/link'
import { useTheme } from '@/components/ThemeContext'


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

      let current = 'xs'
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
        // Show controls when header is NOT visible (scrolled out)
        setShowControls(!entry.isIntersecting)
      },
      { threshold: 0 }
    )

    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  const isDocs = pathname.startsWith('/docs')
  const segments = pathname.split('/').filter(Boolean)

  return (
    <div id="PageToolbar" className={scopedClasses('module-root', styles)}>
      <div className={scopedClasses("page-toolbar", styles)}>
        <div className={scopedClasses("page-toolbar__left", styles)}>
          {isDocs && (
            <button
              className={scopedClasses("page-toolbar__burger", styles)}
              onClick={toggle}
              aria-label="Toggle menu"
            >
              <Menu size={16} />
            </button>
          )}
          <div className={scopedClasses("page-toolbar__title", styles)}>
            <Link href="/" className={scopedClasses("breadcrumb-link-brand", styles)}>
              <span className={scopedClasses("page-toolbar__brand-text", styles)} data-typo="span">UX-DSL</span>
            </Link>
            {segments.map((segment, index) => {
              const href = '/' + segments.slice(0, index + 1).join('/')
              // If segment is 'docs', point to /docs/home to be safe, or keep as is if /docs redirects
              const targetHref = segment === 'docs' ? '/docs/home' : href

              return (
                <Fragment key={segment}>
                  <span className={scopedClasses("breadcrumb-separator", styles)}>/</span>
                  <Link href={targetHref} className={scopedClasses("breadcrumb-link", styles)}>
                    {segment}
                  </Link>
                </Fragment>
              )
            })}
          </div>
        </div>

        <div className={scopedClasses("page-toolbar__right", styles)}>
          <div className={scopedClasses(`page-toolbar__theme-row ${showControls ? 'visible' : ''}`, styles)}>
            <button
              onClick={() => switchTheme('default')}
              className={scopedClasses(`mini-theme-btn default ${currentTheme === 'default' ? 'active' : ''}`, styles)}
              title="Default Theme"
            />
            <button
              onClick={() => switchTheme('green')}
              className={scopedClasses(`mini-theme-btn green ${currentTheme === 'green' ? 'active' : ''}`, styles)}
              title="Green Theme"
            />
            <button
              onClick={() => switchTheme('purple')}
              className={scopedClasses(`mini-theme-btn purple ${currentTheme === 'purple' ? 'active' : ''}`, styles)}
              title="Purple Theme"
            />
            <button onClick={toggleDarkMode} className={scopedClasses("mini-theme-toggle", styles)} title="Toggle Dark Mode">
              {isDark ? <Moon size={12} /> : <Sun size={12} />}
            </button>
          </div>
          <div className={scopedClasses("page-toolbar__info-row", styles)}>
            <span className={scopedClasses("page-toolbar__bp", styles)}>{activeBp.toUpperCase()}</span>
            <span className={scopedClasses("page-toolbar__width", styles)}>{windowWidth}px</span>
          </div>
        </div>
      </div>
    </div>
  )
}
