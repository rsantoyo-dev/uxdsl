import DemoColors from '@/components/DemoColors'
import { PageTitle } from '@/components/PageTitle'

export default function ColorsPage() {
  return (
    <main className="main">
      <div className="container">
        <PageTitle 
          title="Colors" 
          subtitle="Global color palette definitions and swatches."
        />
        <DemoColors />
      </div>
    </main>
  )
}
