'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { breakpoints as runtimeBreakpoints, DEFAULT_BREAKPOINTS } from 'postcss-uxdsl/ds-runtime'

const defaultBreakpoints = {
  ...DEFAULT_BREAKPOINTS,
}

export type Breakpoints = typeof defaultBreakpoints
export type BreakpointKey = keyof Breakpoints

const BreakpointsContext = createContext<{
  breakpoints: Breakpoints
  setBreakpoints: React.Dispatch<React.SetStateAction<Breakpoints>>
}>({
  breakpoints: defaultBreakpoints,
  setBreakpoints: () => {},
})

export function BreakpointsProvider({ children }: { children: ReactNode }) {
  const [breakpoints, setBreakpointsState] = useState(defaultBreakpoints)

  useEffect(() => {
    // Sync with runtime on mount
    // Load persisted values first (if present), then read current runtime map.
    // This keeps the visual editor aligned with live CSS media query rewrites.
    runtimeBreakpoints.load()
    runtimeBreakpoints.get()
    
    // Small delay to allow <link> conversion to happen if needed
    setTimeout(() => {
      const current = runtimeBreakpoints.get()
      if (current && Object.keys(current).length > 0) {
        setBreakpointsState(prev => ({ ...prev, ...current }))
      }
    }, 100)

    // Subscribe to runtime changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unsubscribe = runtimeBreakpoints.subscribe((event: any) => {
      if (event.type === 'breakpoint') {
        const updated = runtimeBreakpoints.get()
        setBreakpointsState(prev => ({ ...prev, ...updated }))
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const setBreakpoints: React.Dispatch<React.SetStateAction<Breakpoints>> = (value) => {
    setBreakpointsState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value
      runtimeBreakpoints.set(next, { persist: true })
      return next
    })
  }

  return (
    <BreakpointsContext.Provider value={{ breakpoints, setBreakpoints }}>
      {children}
    </BreakpointsContext.Provider>
  )
}

export const useBreakpoints = () => useContext(BreakpointsContext)
