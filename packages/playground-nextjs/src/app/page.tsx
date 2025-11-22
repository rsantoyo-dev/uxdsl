import ButtonDemo from '@/components/ButtonDemo'
import CardDemo from '@/components/CardDemo'
import DemoPalette from '@/components/DemoPalette'


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

        <section id="buttons" className="section">
          <h2 className="section-title">Buttons</h2>
          <ButtonDemo />
        </section>

        <section id="cards" className="section">
          <h2 className="section-title">Cards</h2>
          <CardDemo />
        </section>

        <section id="palette" className="section">
          <h2 className="section-title">Demo Palette</h2>
          <DemoPalette />
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
