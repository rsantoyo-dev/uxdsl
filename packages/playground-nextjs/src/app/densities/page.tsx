import DemoDensity from '@/components/DemoDensity'
import { PageTitle } from '@/components/PageTitle'

export default function DensitiesPage() {
  return (
    <main className="main">
      <div className="container">
        <PageTitle 
          title="Densities" 
          subtitle="Compact spacing tokens for component internals."
        />
        <DemoDensity />
      </div>
    </main>
  )
}
