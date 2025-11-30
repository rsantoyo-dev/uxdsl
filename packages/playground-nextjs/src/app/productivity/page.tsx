'use client'

import DemoProductivity from '@/components/DemoProductivity'
import Link from 'next/link'
import { PageTitle } from '@/components/PageTitle'

export default function ProductivityPage() {
  return (
    <main id="ProductivityPage" className="main">
      <div className="container">
        <header className="header">
          <div style={{ marginBottom: '1rem' }}>
            <Link href="/" className="back-link">← Back to Playground</Link>
          </div>
          <PageTitle 
            title="Productivity Challenge"
            subtitle="See how UXDSL reduces code volume and maintenance overhead compared to utility-first frameworks."
          />
        </header>

        <section className="section">
          <DemoProductivity />
        </section>
      </div>
    </main>
  )
}
