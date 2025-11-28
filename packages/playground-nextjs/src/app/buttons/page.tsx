import DemoButtons from '@/components/DemoButtons'
import { PageTitle } from '@/components/PageTitle'

export default function ButtonsPage() {
  return (
    <main className="main">
      <div className="container">
        <PageTitle 
          title="Buttons" 
          subtitle="Interactive elements with various variants and states."
        />
        <DemoButtons />
      </div>
    </main>
  )
}

