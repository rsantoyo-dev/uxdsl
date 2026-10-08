'use client'

import { createContext, useContext, useMemo, ReactNode } from 'react'
import { useTheme } from './ThemeContext'
import { DEFAULT_BREAKPOINTS } from 'uxdsl/theme'

// The breakpoints of the active theme, as one read-only map for the pages that
// need to know the thresholds (the toolbar's active-breakpoint pill, the side
// navigation, the Density inspector).
//
// Read-only on purpose. Thresholds are compiled into every component's media
// queries, so they cannot move at run time: `applyTheme({ breakpoints: { md:
// 900 } })` is refused with UXD_THEME_STRUCTURE. Moving one is an edit to the
// theme file and a rebuild. Simulating a width is inspection, not a change —
// `inspectResponsiveValue` from `uxdsl/language` — and DemoBreakpoints
// does exactly that.

export type Breakpoints = Record<string, number>
export type BreakpointKey = keyof typeof DEFAULT_BREAKPOINTS

const BreakpointsContext = createContext<{ breakpoints: Breakpoints }>({ breakpoints: { ...DEFAULT_BREAKPOINTS } })

export function BreakpointsProvider({ children }: { children: ReactNode }) {
  const { activeThemeData } = useTheme()
  const configured = JSON.stringify({ ...DEFAULT_BREAKPOINTS, ...activeThemeData?.breakpoints })
  const value = useMemo(() => ({ breakpoints: JSON.parse(configured) as Breakpoints }), [configured])
  return (
    <BreakpointsContext.Provider value={value}>
      {children}
    </BreakpointsContext.Provider>
  )
}

export const useBreakpoints = () => useContext(BreakpointsContext)
