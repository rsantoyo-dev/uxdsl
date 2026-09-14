import DemoSpacing from '@/components/DemoSpacing'
import SpacingExplanation from '@/components/SpacingExplanation'
import SpacingAgentGuidance from '@/components/SpacingAgentGuidance'
import { PageTitle } from '@/components/PageTitle'

export default function SpacingPage() {
  return (
    <main className="main">
      <div className="container">
        <PageTitle 
          title="Spacing" 
          subtitle="Define spacing once. Update every consumer from your theme."
        />
        <SpacingExplanation />
        <DemoSpacing />
        <SpacingAgentGuidance />
      </div>
    </main>
  )
}
