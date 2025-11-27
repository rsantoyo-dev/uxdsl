'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

const defaultBreakpoints = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
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
  const [breakpoints, setBreakpoints] = useState(defaultBreakpoints)

  // Runtime CSS Injection
  useEffect(() => {
    const styleId = 'uxdsl-breakpoints-runtime'
    let styleEl = document.getElementById(styleId)
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }
    
    // Use template literal for multi-line string to avoid syntax errors
    let css = `:root {
`
    Object.entries(breakpoints).forEach(([key, val]) => {
      css += `  --breakpoint-${key}: ${val}px;
`
    })
    css += '}'
    styleEl.textContent = css
  }, [breakpoints])

  return (
    <BreakpointsContext.Provider value={{ breakpoints, setBreakpoints }}>
      {children}
    </BreakpointsContext.Provider>
  )
}

export const useBreakpoints = () => useContext(BreakpointsContext)
