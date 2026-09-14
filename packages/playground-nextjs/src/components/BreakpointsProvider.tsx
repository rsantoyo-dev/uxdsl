'use client'

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { useTheme } from './ThemeContext'
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
  const { activeThemeData, setCustomTheme, customThemeName } = useTheme()
  const [breakpoints, setBreakpointsState] = useState(defaultBreakpoints)
  const currentTheme = useRef({ activeThemeData, setCustomTheme, customThemeName })
  currentTheme.current = { activeThemeData, setCustomTheme, customThemeName }
  const configured = JSON.stringify({ ...DEFAULT_BREAKPOINTS, ...activeThemeData?.breakpoints })
  useEffect(() => {
    const map = JSON.parse(configured)
    setBreakpointsState(map)
    runtimeBreakpoints.set(map, { replace: true })
  }, [configured])

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
        const current = currentTheme.current
        const configuredMap = { ...DEFAULT_BREAKPOINTS, ...current.activeThemeData?.breakpoints }
        if (Object.entries(updated).some(([name, width]) => configuredMap[name] !== width)) {
          current.setCustomTheme(current.customThemeName || 'Custom Theme', { breakpoints: updated })
        }
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const setBreakpoints: React.Dispatch<React.SetStateAction<Breakpoints>> = (value) => {
    const next = typeof value === 'function' ? value(breakpoints) : value
    runtimeBreakpoints.set(next, { persist: true })
  }

  return (
    <BreakpointsContext.Provider value={{ breakpoints, setBreakpoints }}>
      {children}
    </BreakpointsContext.Provider>
  )
}

export const useBreakpoints = () => useContext(BreakpointsContext)
