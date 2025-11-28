import DemoBorders from '@/components/DemoBorders'
import { PageTitle } from '@/components/PageTitle'

export default function BordersPage() {
  return (
    <main className="main">
      <div className="container">
        <PageTitle 
          title="Borders" 
          subtitle="Border widths, styles, and radius tokens."
        />
        <DemoBorders />
      </div>
    </main>
  )
}
