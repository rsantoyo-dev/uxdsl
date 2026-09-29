"use client"


import styles from './HomeInteractiveDemos.module.css'
import { scopedClasses } from '../lib/uxdsl-module-classes'
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
      className={scopedClasses("docs-link", styles)}
    >
      Docs <ArrowRight size={12} />
    </Link>
  )
}

export default function HomeInteractiveDemos() {
  const [showExtended, setShowExtended] = useState(false)

  return (
    <div className={scopedClasses("home-demos", styles)}>
      <div className={scopedClasses("demos-grid", styles)}>
        {/* Breakpoints Demo */}
        <div className={scopedClasses("demo-item demo-item-full", styles)}>
          <DemoBreakpoints />
        </div>

        {/* Typography Demo */}
        <div className={scopedClasses("demo-item demo-item-full", styles)}>
          <TypographyInteractivePlayground action={<DocsLink href="/docs/typography" />} />
        </div>

        {showExtended && (
          <>
            {/* Palette Usage Demo */}
            <div className={scopedClasses("demo-item", styles)}>
              <PalettePlayground action={<DocsLink href="/docs/palette#usage" />} />
            </div>

            {/* Palette Explorer Demo */}
            <div className={scopedClasses("demo-item", styles)}>
              <PaletteThemeExplorer action={<DocsLink href="/docs/palette#explorer" />} />
            </div>
          </>
        )}
      </div>

      <div className={scopedClasses("home-demos__actions", styles)}>
        <button
          type="button"
          className={scopedClasses("home-demos__toggle", styles)}
          onClick={() => setShowExtended((v) => !v)}
        >
          {showExtended ? 'Show Less Demos' : 'Show More Demos'}
        </button>
      </div>
    </div>
  )
}
