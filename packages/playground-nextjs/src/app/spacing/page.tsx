import DemoSpacing from '@/components/DemoSpacing'
import { PageTitle } from '@/components/PageTitle'

export default function SpacingPage() {
  return (
    <main className="main">
      <div className="container">
        <PageTitle 
          title="Spacing" 
          subtitle="Consistent spacing scale for margins, padding, and layout."
        />
        <DemoSpacing />
      </div>
    </main>
  )
}
