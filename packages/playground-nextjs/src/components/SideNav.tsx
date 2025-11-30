'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { useBreakpoints } from '@/components/BreakpointsProvider'
import { useNav } from '@/components/NavContext'

const staticLinks: { href: string; label: string }[] = []

interface SideNavProps {
  docsLinks?: Array<{ href: string; label: string }>
}

export default function SideNav({ docsLinks = [] }: SideNavProps) {
  const pathname = usePathname()
  const { isOpen, setIsOpen } = useNav()
  const { breakpoints } = useBreakpoints()

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false)
  }, [pathname, setIsOpen])

  // Close menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= breakpoints.lg && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoints.lg, isOpen, setIsOpen])

  const renderLink = (l: { href: string; label: string }) => {
    const active = pathname === l.href
    return (
      <li key={l.href} className="side-nav__item">
        <Link
          href={l.href}
          className="side-nav__link"
          aria-current={active ? 'page' : undefined}
          onClick={() => setIsOpen(false)}
        >
          {l.label}
        </Link>
      </li>
    )
  }

  return (
    <div id="SideNav">
      <nav className="side-nav" aria-label="Sections">
        {/* Mobile Backdrop */}
        <div
          className={`side-nav__backdrop ${isOpen ? 'is-open' : ''}`}
          onClick={() => setIsOpen(false)}
        />

        {/* Menu Container (Drawer on mobile, Sidebar on desktop) */}
        <div className={`side-nav__menu ${isOpen ? 'is-open' : ''}`}>
          <div className="side-nav__header">
            <div className="side-nav__title">Menu</div>
            <button className="side-nav__close" onClick={() => setIsOpen(false)} aria-label="Close menu">
              ✕
            </button>
          </div>

          {staticLinks.length > 0 && (
            <div className="side-nav__section">
              <div className="side-nav__section-title">Playground</div>
              <ul className="side-nav__list">
                {staticLinks.map(renderLink)}
              </ul>
            </div>
          )}

          {docsLinks.length > 0 && (
            <div className="side-nav__section">
              <div className="side-nav__section-title">Documentation</div>
              <ul className="side-nav__list">
                {docsLinks.map(renderLink)}
              </ul>
            </div>
          )}
        </div>
      </nav>
    </div>
  )
}
