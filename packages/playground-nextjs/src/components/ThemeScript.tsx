'use client'

import { useServerInsertedHTML } from 'next/navigation'

interface Theme {
  modes?: {
    dark?: {
      palette?: Record<string, string>
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export default function ThemeScript({ theme }: { theme: Theme }) {
  useServerInsertedHTML(() => {
    if (!theme) return null
    
    const cssVars: string[] = []
    
    if (theme.palette) {
      Object.entries(theme.palette).forEach(([key, val]) => {
        if (typeof val === 'object' && val !== null) {
          Object.entries(val).forEach(([subKey, subVal]) => {
            cssVars.push(`--ds__palette__${key}-${subKey}: ${subVal}`)
          })
        } else {
          cssVars.push(`--ds__palette__${key}: ${val}`)
        }
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

    let cssContent = `:root { ${cssVars.join('; ')} }`

    if (theme.modes && theme.modes.dark && theme.modes.dark.palette) {
      const darkVars: string[] = []
      Object.entries(theme.modes.dark.palette).forEach(([key, val]) => {
        darkVars.push(`--${key}: ${val}`)
        darkVars.push(`--ds__palette__${key}: ${val}`)
      })
      cssContent += ` @media (prefers-color-scheme: dark) { :root { ${darkVars.join('; ')} } }`
    }

    return (
      <style
        id="uxdsl-ssr-theme"
        dangerouslySetInnerHTML={{ __html: cssContent }}
      />
    )
  })

  return null
}
