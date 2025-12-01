'use client'

import { useNav } from '@/components/NavContext'
import { Menu } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useBreakpoints, BreakpointKey } from '@/components/BreakpointsProvider'
import { useState, useEffect, Fragment } from 'react'
import Link from 'next/link'

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
            <Link href="/" className="breadcrumb-link">uxdsl</Link>
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
          <span className="page-toolbar__bp">{activeBp.toUpperCase()}</span>
          <span className="page-toolbar__width">{windowWidth}px</span>
        </div>
      </div>
    </div>
  )
}
