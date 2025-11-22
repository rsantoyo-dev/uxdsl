'use client'

import { useServerInsertedHTML } from 'next/navigation'

export default function ThemeScript({ theme }: { theme: any }) {
  useServerInsertedHTML(() => {
    if (!theme) return null
    
    const cssVars: string[] = []
    
    if (theme.palette) {
      Object.entries(theme.palette).forEach(([key, val]) => {
        cssVars.push(`--${key}: ${val}`)
        cssVars.push(`--ds__palette__${key}: ${val}`)
      })
    }
    if (theme.spacing) {
      Object.entries(theme.spacing).forEach(([key, val]) => {
        cssVars.push(`--${key}: ${val}`)
      })
    }
    if (theme.typography) {
      Object.entries(theme.typography).forEach(([key, val]) => {
        cssVars.push(`--${key}: ${val}`)
      })
    }

    return (
      <style
        id="uxdsl-ssr-theme"
        dangerouslySetInnerHTML={{ __html: `:root { ${cssVars.join('; ')} }` }}
      />
    )
  })

  return null
}
