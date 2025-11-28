import DemoTypography from '../../components/DemoTypography'
import { PageTitle } from '@/components/PageTitle'

export default function TypographyPage() {
  return (
    <main className="main">
      <div className="container">
        <PageTitle 
          title="Typography" 
          subtitle="Type scale, font families, and text styles."
        />
        <DemoTypography />
      </div>
    </main>
  )
}

