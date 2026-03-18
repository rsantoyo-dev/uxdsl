"use client"

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import DemoBreakpoints from './DemoBreakpoints'
import { TypographyInteractivePlayground } from './TypographyInteractivePlayground'
import PalettePlayground from './PalettePlayground'
import PaletteThemeExplorer from './PaletteThemeExplorer'

function DocsLink({ href }: { href: string }) {
  return (
    <Link 
      href={href} 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.25rem', 
        fontSize: '0.75rem', 
        color: 'var(--ds__palette__primary-main)',
        textDecoration: 'none',
        fontWeight: 600
      }}
    >
      Docs <ArrowRight size={12} />
    </Link>
  )
}

export default function HomeInteractiveDemos() {
  const [showExtended, setShowExtended] = useState(false)

  return (
    <div className="home-demos">
      <div className="demos-grid">
        {/* Breakpoints Demo */}
        <div className="demo-item demo-item-full">
          <DemoBreakpoints />
        </div>

        {/* Typography Demo */}
        <div className="demo-item demo-item-full">
          <TypographyInteractivePlayground action={<DocsLink href="/docs/typography" />} />
        </div>

        {showExtended && (
          <>
            {/* Palette Usage Demo */}
            <div className="demo-item">
              <PalettePlayground action={<DocsLink href="/docs/palette#usage" />} />
            </div>

            {/* Palette Explorer Demo */}
            <div className="demo-item">
              <PaletteThemeExplorer action={<DocsLink href="/docs/palette#explorer" />} />
            </div>
          </>
        )}
      </div>

      <div className="home-demos__actions">
        <button
          type="button"
          className="home-demos__toggle"
          onClick={() => setShowExtended((v) => !v)}
        >
          {showExtended ? 'Show Less Demos' : 'Show More Demos'}
        </button>
      </div>
    </div>
  )
}
