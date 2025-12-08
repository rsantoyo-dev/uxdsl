import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { TypographyDemoProvider } from './TypographyDemoContext'
import { ResponsiveSyntaxExplainer } from './ResponsiveSyntaxExplainer'
import PalettePlayground from './PalettePlayground'

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
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 600px), 1fr))', 
      gap: '2rem',
      width: '100%'
    }}>
      {/* Typography Demo */}
      <div style={{ minWidth: 0 }}>
        <TypographyDemoProvider>
          <ResponsiveSyntaxExplainer action={<DocsLink href="/docs/typography" />} />
        </TypographyDemoProvider>
      </div>
      
      {/* Palette Demo */}
      <div style={{ minWidth: 0 }}>
        <PalettePlayground action={<DocsLink href="/docs/palette" />} />
      </div>
    </div>
  )
}
