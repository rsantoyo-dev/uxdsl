'use client'

import { useEffect } from 'react'
import { applyPalette, loadPersisted, resetPalette } from 'postcss-uxdsl/ds-runtime'

type Palette = Record<string, string>

export default function ThemeProvider({
  palette,
  persist = true,
  children,
}: {
  palette?: Palette
  persist?: boolean
  children: React.ReactNode
}) {
  useEffect(() => {
    if (persist) {
      try { loadPersisted() } catch {}
    } else {
      try { resetPalette(undefined, { clearPersist: true }) } catch {}
    }
    if (palette && Object.keys(palette).length) {
      try { applyPalette(palette, { persist }) } catch {}
    }
  }, [palette, persist])

  return <>{children}</>
}

