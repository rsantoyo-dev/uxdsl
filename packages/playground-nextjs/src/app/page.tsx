import ButtonDemo from '@/components/ButtonDemo'
import CardDemo from '@/components/CardDemo'
import DemoPalette from '@/components/DemoPalette'
import DemoSurfaces from '@/components/DemoSurfaces'
import DemoColors from '@/components/DemoColors'
import DemoTypography from '@/components/DemoTypography'
import DemoSpacing from '@/components/DemoSpacing'
import InputDemo from '@/components/InputDemo'

export default function Home() {
  return (
    <main className="main">
      <div className="container">
        <header className="header">
          <h1 className="title">UXDSL Next.js Playground</h1>
          <p className="subtitle">
            UXDSL styling in Next.js with SSR support - No Tailwind, pure design system
          </p>
        </header>

        <section id="welcome" className="section">
          <h2 className="section-title">Welcome to UXDSL</h2>
          <p>This playground demonstrates UXDSL working in Next.js with full SSR support.</p>
          <p>UXDSL is a lightweight CSS DSL that provides design system features, runtime theming, and responsive utilities without requiring Tailwind or other CSS frameworks.</p>
        </section>

        <section id="features" className="section">
          <h2 className="section-title">Features</h2>
          <ul>
            <li>🎨 Design system tokens and variables</li>
            <li>📱 Responsive breakpoints and utilities</li>
            <li>🎯 Component-based styling with @ds-button, @ds-surface, @ds-typo</li>
            <li>⚡ Optimized PostCSS processing</li>
            <li>🔧 TypeScript support</li>
            <li>🚀 SSR-compatible with Next.js</li>
          </ul>
        </section>

        <section id="colors" className="section">
          <h2 className="section-title">Colors</h2>
          <DemoColors />
        </section>

        <section id="palette" className="section">
          <h2 className="section-title">Palette</h2>
          <DemoPalette />
        </section>

        <section id="surfaces" className="section">
          <h2 className="section-title">Surfaces</h2>
          <DemoSurfaces />
        </section>

        <section id="typography" className="section">
          <h2 className="section-title">Typography</h2>
          <DemoTypography />
        </section>

        <section id="spacing" className="section">
          <h2 className="section-title">Spacing</h2>
          <DemoSpacing />
        </section>

        <section id="buttons" className="section">
          <h2 className="section-title">Buttons</h2>
          <ButtonDemo />
        </section>

        <section id="inputs" className="section">
          <h2 className="section-title">Inputs</h2>
          <InputDemo />
        </section>

        <section id="cards" className="section">
          <h2 className="section-title">Cards</h2>
          <CardDemo />
        </section>

        <section id="productivity" className="section">
          <h2 className="section-title">Productivity Challenge</h2>
          <p style={{ marginBottom: '1rem' }}>
            Compare UXDSL against Tailwind CSS and see how much code you can save.
          </p>
          <a href="/productivity" className="prod-btn-primary" style={{ display: 'inline-block', width: 'auto', textDecoration: 'none' }}>
            View Comparison Demo
          </a>
        </section>

        <section id="getting-started" className="section">
          <h2 className="section-title">Getting Started</h2>
          <p>To use UXDSL in your project:</p>
          <ol>
            <li>Install the postcss-uxdsl plugin</li>
            <li>Configure PostCSS to use the plugin</li>
            <li>Import your .uxdsl style files</li>
            <li>Use @ds-* at-rules for components and utilities</li>
          </ol>
        </section>
      </div>
    </main>
  )
}
