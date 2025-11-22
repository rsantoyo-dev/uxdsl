'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const links = [
  { href: '/', label: 'Home' },
  { href: '/colors', label: 'Colors' },
  { href: '/palette', label: 'Palette' },
  { href: '/typography', label: 'Typography' },
  { href: '/spacing', label: 'Spacing' },
  { href: '/densities', label: 'Densities' },
  { href: '/theming', label: 'Theming' },
  { href: '/surfaces', label: 'Surfaces' },
  { href: '/buttons', label: 'Buttons' },
  { href: '/inputs', label: 'Inputs' },
]

export default function SideNav() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <nav className="side-nav" aria-label="Sections">
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

        <div className="side-nav__section">
          <div className="side-nav__section-title">Docs</div>
          <ul className="side-nav__list">
            {links.map((l) => {
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
            })}
          </ul>
        </div>
      </div>
    </nav>
  )
}
