import DemoDensity from '@/components/DemoDensity'

export default function DensitiesPage() {
  return (
    <main className="main">
      <div className="container">
        <h1 className="section-title">Densities</h1>
        <p>
          Padding set via <code>density(N)</code> → <code>var(--density-N)</code>.
        </p>
        <DemoDensity />
      </div>
    </main>
  )
}
