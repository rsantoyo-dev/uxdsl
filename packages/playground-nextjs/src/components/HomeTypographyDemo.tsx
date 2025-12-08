'use client'

import { TypographyDemoProvider } from './TypographyDemoContext'
import { ResponsiveSyntaxExplainer } from './ResponsiveSyntaxExplainer'

export default function HomeTypographyDemo() {
  return (
    <TypographyDemoProvider>
      <ResponsiveSyntaxExplainer />
    </TypographyDemoProvider>
  )
}
