import React from 'react'
import { generateThemeCss } from 'postcss-uxdsl/ds-runtime'

interface Theme {
  modes?: {
    dark?: {
      palette?: Record<string, string | Record<string, string>>
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export default function ThemeScript({ theme }: { theme: Theme }) {
  if (!theme) return null
  
  const cssContent = generateThemeCss(theme)

  return (
    <style
      id="uxdsl-ssr-theme"
      dangerouslySetInnerHTML={{ __html: cssContent }}
    />
  )
}
