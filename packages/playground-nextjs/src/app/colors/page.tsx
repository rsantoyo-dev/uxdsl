import DemoColors from '@/components/DemoColors'
import { ColorExplanation, ColorAgentGuidance } from '@/components/ColorDocumentation'
import { PageTitle } from '@/components/PageTitle'

export default function ColorsPage() {
  return (
    <main className="main">
      <div className="container">
        <PageTitle 
          title="Colors" 
          subtitle="Define reusable color values. Connect them to palette roles in your theme."
        />
        <ColorExplanation topic="colors" />
        <DemoColors />
        <ColorAgentGuidance topic="colors" />
      </div>
    </main>
  )
}
