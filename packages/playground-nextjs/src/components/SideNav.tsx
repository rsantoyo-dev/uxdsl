'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
  return (
    <nav className="side-nav" aria-label="Sections">
      <div className="side-nav__section">
        <div className="side-nav__section-title">Docs</div>
        <ul className="side-nav__list">
          {links.map((l) => {
            const active = pathname === l.href
            return (
              <li key={l.href} className="side-nav__item">
                <Link href={l.href} className="side-nav__link" aria-current={active ? 'page' : undefined}>
                  {l.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
