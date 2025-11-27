'use client'

import ThemeProvider from '@/components/ThemeProvider'
import { BreakpointsProvider } from '@/components/BreakpointsProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider persist={false}>
      <BreakpointsProvider>
        {children}
      </BreakpointsProvider>
    </ThemeProvider>
  )
}
