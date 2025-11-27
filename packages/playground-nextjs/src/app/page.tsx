import UXDSLCardDemo from '../components/UXDSLCardDemo'

export const dynamic = 'force-dynamic'

export default function Home() {
  return (
    <main className="main">
      <div className="container">
        <header className="header">
          <h1 className="title">UX-DSL</h1>
          <p className="subtitle">
            Design System Language
            <br />
            <span style={{ opacity: 0.7, fontSize: '0.9em' }}>Next.js Live Demo</span>
          </p>
        </header>

        <section id="welcome" className="section">
          <div className="welcome-card">
            <p className="welcome-text">
              <strong>UX-DSL</strong> is a PostCSS-based design system language that supercharges your productivity by embedding responsive and theme-aware tokens directly into your workflow.
            </p>
            <p className="welcome-text">
              By combining a pleasant, CSS-like syntax with the raw power of SCSS, it delivers a developer experience that is both intuitive and robust. UX-DSL compiles at build time for lightning-fast, zero-runtime-overhead performance, while a dedicated runtime plugin enables instant token updates for dynamic theming.
            </p>
            <p className="welcome-text">
              It ensures consistent design constraints where you need them—handling typography, spacing, and surfaces automatically—without sacrificing the creative liberty and advanced features that SCSS offers.
            </p>
          </div>
        </section>

        <section className="section">
          <h2 style={{ textAlign: 'center', marginBottom: '2rem', opacity: 0.9 }}>See it in Action</h2>
          <UXDSLCardDemo />
        </section>
      </div>
    </main>
  )
}