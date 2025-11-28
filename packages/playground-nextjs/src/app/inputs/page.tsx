import InputDemo from '@/components/InputDemo'
import { PageTitle } from '@/components/PageTitle'

export default function InputsPage() {
  return (
    <main className="main">
      <div className="container">
        <PageTitle 
          title="Inputs" 
          subtitle="Form controls and data entry components."
        />
        <InputDemo />
      </div>
    </main>
  )
}

