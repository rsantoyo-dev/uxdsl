import DemoPalette from '@/components/DemoPalette'
import { PageTitle } from '@/components/PageTitle'

export default function PalettePage() {
  return (
    <main className="main">
      <div className="container">
        <PageTitle 
          title="Palette" 
          subtitle="Semantic color mappings for primary, secondary, and surface roles."
        />
        <DemoPalette />
      </div>
    </main>
  )
}
