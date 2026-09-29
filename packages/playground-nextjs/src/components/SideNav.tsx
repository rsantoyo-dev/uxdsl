'use client'


import styles from './SideNav.module.css'
import { scopedClasses } from '../lib/uxdsl-module-classes'
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
      <li key={l.href} className={scopedClasses("side-nav__item", styles)}>
        <Link
          href={l.href}
          className={scopedClasses("side-nav__link", styles)}
          aria-current={active ? 'page' : undefined}
          onClick={() => setIsOpen(false)}
        >
          {l.label}
        </Link>
      </li>
    )
  }

  return (
    <div id="SideNav" className={scopedClasses('module-root', styles)}>
      <nav className={scopedClasses("side-nav", styles)} aria-label="Sections">
        {/* Mobile Backdrop */}
        <div
          className={scopedClasses(`side-nav__backdrop ${isOpen ? 'is-open' : ''}`, styles)}
          onClick={() => setIsOpen(false)}
        />

        {/* Menu Container (Drawer on mobile, Sidebar on desktop) */}
        <div className={scopedClasses(`side-nav__menu ${isOpen ? 'is-open' : ''}`, styles)}>
          <div className={scopedClasses("side-nav__header", styles)}>
            <div className={scopedClasses("side-nav__title", styles)}>Menu</div>
            <button className={scopedClasses("side-nav__close", styles)} onClick={() => setIsOpen(false)} aria-label="Close menu">
              ✕
            </button>
          </div>

          {staticLinks.length > 0 && (
            <div className={scopedClasses("side-nav__section", styles)}>
              <div className={scopedClasses("side-nav__section-title", styles)}>Playground</div>
              <ul className={scopedClasses("side-nav__list", styles)}>
                {staticLinks.map(renderLink)}
              </ul>
            </div>
          )}

          {docsLinks.length > 0 && (
            <div className={scopedClasses("side-nav__section", styles)}>
              <div className={scopedClasses("side-nav__section-title", styles)}>Documentation</div>
              <ul className={scopedClasses("side-nav__list", styles)}>
                {docsLinks.map(renderLink)}
              </ul>
            </div>
          )}
        </div>
      </nav>
    </div>
  )
}
