import DemoDensity from '@/components/DemoDensity'
import { PageTitle } from '@/components/PageTitle'

export default function DensitiesPage() {
  return (
    <main className="main">
      <div className="container">
        <PageTitle 
          title="Densities" 
          subtitle="Define responsive spacing once. Keep every connected component in rhythm."
        />
        <DemoDensity />
      </div>
    </main>
  )
}
