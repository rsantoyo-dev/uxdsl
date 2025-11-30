'use client'

import { useNav } from '@/components/NavContext'
import { Menu } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useBreakpoints, BreakpointKey } from '@/components/BreakpointsProvider'
import { useState, useEffect } from 'react'

export default function PageToolbar() {
  const { toggle } = useNav()
  const pathname = usePathname()
  const { breakpoints } = useBreakpoints()
  const [activeBp, setActiveBp] = useState<string>('xs')
  const [windowWidth, setWindowWidth] = useState(0)

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth
      setWindowWidth(w)
      
      const keys = Object.keys(breakpoints) as BreakpointKey[]
      keys.sort((a, b) => breakpoints[a] - breakpoints[b])
      
      let current = 'xs'
      for (const key of keys) {
        if (w >= breakpoints[key]) {
          current = key
        }
      }
      setActiveBp(current)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoints])

  // Format pathname for display (e.g. "/docs/home" -> "Docs / Home")
  const pageTitle = pathname === '/' ? 'Home' : pathname.split('/').filter(Boolean).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' / ')
  const isDocs = pathname.startsWith('/docs')

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
            {pageTitle}
          </div>
        </div>

        <div className="page-toolbar__right">
          <span className="page-toolbar__bp">{activeBp.toUpperCase()}</span>
          <span className="page-toolbar__width">{windowWidth}px</span>
        </div>
      </div>
    </div>
  )
}
