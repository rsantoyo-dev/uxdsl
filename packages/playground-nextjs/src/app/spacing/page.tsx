import DemoSpacing from '@/components/DemoSpacing'

export default function SpacingPage() {
  return (
    <main className="main">
      <div className="container">
        <h1 className="section-title">Spacing</h1>
        <p>Padding set via <code>space(N)</code> → <code>var(--space-N)</code>.</p>
        <DemoSpacing />
      </div>
    </main>
  )
}
