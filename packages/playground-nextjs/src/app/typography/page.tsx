'use client'

import { TypographyDemos } from '../../components/TypographyDemos'
import { PageTitle } from '@/components/PageTitle'
import Documentation from './documentation.mdx'

export default function TypographyPage() {
  return (
    <main className="main">
      <div className="container">
        <PageTitle 
          title="Typography" 
          subtitle="Type scale, font families, and text styles."
        />
        <TypographyDemos />
        <div className="typography-page__documentation">
          <Documentation />
        </div>
      </div>
    </main>
  )
}

