'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react'
import { useTheme } from './ThemeContext'
import { DEFAULT_BREAKPOINTS } from 'uxdsl/theme'
import { applyToDocument } from '../lib/breakpoint-preview'

// The breakpoints of the page, as one map for the parts that need the thresholds
// (the toolbar's active-breakpoint pill, the side navigation, the Density and
// Breakpoints demos), plus the Live theme handler's preview.
//
// Thresholds are compiled into every component's media queries, so the theme
// cannot move them at run time: `applyTheme({ breakpoints: { md: 900 } })` is
// refused with UXD_THEME_STRUCTURE, and moving one for real is an edit to the
// theme file and a rebuild. The preview moves the compiled media rules of this
// page instead (src/lib/breakpoint-preview.js). `compiled` is what the site was
// built with; `breakpoints` is what the page uses now, the preview included, so
// everything reading it agrees with the page.

export type Breakpoints = Record<string, number>
export type BreakpointKey = keyof typeof DEFAULT_BREAKPOINTS

type BreakpointsContextValue = {
  breakpoints: Breakpoints
  compiled: Breakpoints
  preview: Breakpoints | null
  setPreview: (next: Breakpoints | null) => void
  movedRules: number
}

const defaults = { ...DEFAULT_BREAKPOINTS }
const BreakpointsContext = createContext<BreakpointsContextValue>({
  breakpoints: defaults,
  compiled: defaults,
  preview: null,
  setPreview: () => {},
  movedRules: 0,
})

export function BreakpointsProvider({ children }: { children: ReactNode }) {
  const { activeThemeData } = useTheme()
  const configured = JSON.stringify({ ...DEFAULT_BREAKPOINTS, ...activeThemeData?.breakpoints })
  const compiled = useMemo(() => JSON.parse(configured) as Breakpoints, [configured])
  const [preview, setPreview] = useState<Breakpoints | null>(null)
  const [movedRules, setMovedRules] = useState(0)
  const originals = useRef(new WeakMap())
  const touched = useRef(false)

  // Rewrite the page's media rules now, and again whenever a stylesheet changes:
  // applyTheme regenerates the theme's own <style> on every palette edit, and a
  // client-side navigation loads the next page's CSS.
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!preview && !touched.current) return
    const target = preview || compiled
    let frame = 0
    const apply = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setMovedRules(applyToDocument(document, compiled, target, originals.current)))
    }
    apply()
    touched.current = Boolean(preview)
    if (!preview) return () => cancelAnimationFrame(frame)
    const observer = new MutationObserver(apply)
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })
    document.addEventListener('load', apply, true) // a <link rel="stylesheet"> that finished loading
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('load', apply, true)
    }
  }, [preview, compiled])

  const value = useMemo(
    () => ({ breakpoints: preview || compiled, compiled, preview, setPreview, movedRules }),
    [preview, compiled, movedRules],
  )
  return <BreakpointsContext.Provider value={value}>{children}</BreakpointsContext.Provider>
}

export const useBreakpoints = () => useContext(BreakpointsContext)
