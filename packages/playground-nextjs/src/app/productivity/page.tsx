'use client'

import DemoProductivity from '@/components/DemoProductivity'
import Link from 'next/link'

export default function ProductivityPage() {
  return (
    <main className="main">
      <div className="container">
        <header className="header">
          <div style={{ marginBottom: '1rem' }}>
            <Link href="/" className="back-link">← Back to Playground</Link>
          </div>
          <h1 className="title">Productivity Challenge</h1>
          <p className="subtitle">
            See how UXDSL reduces code volume and maintenance overhead compared to utility-first frameworks.
          </p>
        </header>

        <section className="section">
          <DemoProductivity />
        </section>
      </div>
    </main>
  )
}
