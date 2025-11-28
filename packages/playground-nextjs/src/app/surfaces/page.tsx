import DemoSurfaces from '@/components/DemoSurfaces'
import { PageTitle } from '@/components/PageTitle'

export default function SurfacesPage() {
  return (
    <main className="main">
      <div className="container">
        <PageTitle 
          title="Surfaces" 
          subtitle="Background layers, cards, and elevation styles."
        />
        <DemoSurfaces />
      </div>
    </main>
  )
}

