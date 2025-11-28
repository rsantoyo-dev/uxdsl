import DemoBreakpoints from '@/components/DemoBreakpoints'
import { PageTitle } from '@/components/PageTitle'

export default function BreakpointsPage() {
  return (
    <main className="main">
      <div className="container">
        <PageTitle 
          title="Breakpoints" 
          subtitle="Responsive design breakpoints configuration and active state monitoring."
        />
        <DemoBreakpoints />
      </div>
    </main>
  )
}
