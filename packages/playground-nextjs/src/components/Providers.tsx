'use client'

import { ThemeContextProvider } from '@/components/ThemeContext'
import { BreakpointsProvider } from '@/components/BreakpointsProvider'
import { NavProvider } from '@/components/NavContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContextProvider>
      <BreakpointsProvider>
        <NavProvider>
          {children}
        </NavProvider>
      </BreakpointsProvider>
    </ThemeContextProvider>
  )
}
