'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useBreakpoints } from '@/components/BreakpointsProvider'

const staticLinks: { href: string; label: string }[] = []

interface SideNavProps {
  docsLinks?: Array<{ href: string; label: string }>
}

export default function SideNav({ docsLinks = [] }: SideNavProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const { breakpoints } = useBreakpoints()
  const [isDesktop, setIsDesktop] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= breakpoints.lg)
    }
    handleResize() // Initial check
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoints.lg]) // Re-run if lg breakpoint changes

  // Prevent hydration mismatch by rendering simple shell or default until mounted
  // Or just accept the class swap.
  const modeClass = mounted ? (isDesktop ? 'side-nav--desktop' : 'side-nav--mobile') : 'side-nav--desktop'

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
    <nav className={`side-nav ${modeClass}`} aria-label="Sections">
      {/* Mobile Burger */}
      <button
        className="side-nav__burger"
        onClick={() => setIsOpen(true)}
        aria-label="Open menu"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      </button>

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
  )
}
