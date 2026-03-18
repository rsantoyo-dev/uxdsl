'use client'

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
    <div id="PageToolbar">
      <div className="page-toolbar">
        <div className="page-toolbar__left">
          {isDocs && (
            <button 
              className="page-toolbar__burger" 
              onClick={toggle}
              aria-label="Toggle menu"
            >
              <Menu size={16} />
            </button>
          )}
          <div className="page-toolbar__title">
            <Link href="/" className="breadcrumb-link-brand">
              <span className="page-toolbar__brand-text" data-typo="span">UX-DSL</span>
            </Link>
            {segments.map((segment, index) => {
              const href = '/' + segments.slice(0, index + 1).join('/')
              // If segment is 'docs', point to /docs/home to be safe, or keep as is if /docs redirects
              const targetHref = segment === 'docs' ? '/docs/home' : href
              
              return (
                <Fragment key={segment}>
                  <span className="breadcrumb-separator">/</span>
                  <Link href={targetHref} className="breadcrumb-link">
                    {segment}
                  </Link>
                </Fragment>
              )
            })}
          </div>
        </div>

        <div className="page-toolbar__right">
          <div className={`page-toolbar__theme-row ${showControls ? 'visible' : ''}`}>
            <button 
              onClick={() => switchTheme('default')} 
              className={`mini-theme-btn default ${currentTheme === 'default' ? 'active' : ''}`} 
              title="Default Theme"
            />
            <button 
              onClick={() => switchTheme('green')} 
              className={`mini-theme-btn green ${currentTheme === 'green' ? 'active' : ''}`} 
              title="Green Theme"
            />
            <button 
              onClick={() => switchTheme('purple')} 
              className={`mini-theme-btn purple ${currentTheme === 'purple' ? 'active' : ''}`} 
              title="Purple Theme"
            />
            <button onClick={toggleDarkMode} className="mini-theme-toggle" title="Toggle Dark Mode">
              {isDark ? <Moon size={12} /> : <Sun size={12} />}
            </button>
          </div>
          <div className="page-toolbar__info-row">
            <span className="page-toolbar__bp">{activeBp.toUpperCase()}</span>
            <span className="page-toolbar__width">{windowWidth}px</span>
          </div>
        </div>
      </div>
    </div>
  )
}
