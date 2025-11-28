import DemoShadows from '@/components/DemoShadows'
import { PageTitle } from '@/components/PageTitle'

export default function ShadowsPage() {
  return (
    <main className="main">
      <div className="container">
        <PageTitle 
          title="Shadows" 
          subtitle="Elevation and depth tokens."
        />
        <DemoShadows />
      </div>
    </main>
  )
}
