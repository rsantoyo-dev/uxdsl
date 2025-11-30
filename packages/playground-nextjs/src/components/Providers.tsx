'use client'

import ThemeProvider from '@/components/ThemeProvider'
import { BreakpointsProvider } from '@/components/BreakpointsProvider'
import { NavProvider } from '@/components/NavContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider persist={false}>
      <BreakpointsProvider>
        <NavProvider>
          {children}
        </NavProvider>
      </BreakpointsProvider>
    </ThemeProvider>
  )
}
