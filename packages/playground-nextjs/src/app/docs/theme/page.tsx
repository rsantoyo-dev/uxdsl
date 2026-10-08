import { PageTitle } from '@/components/PageTitle'
import ThemeConfigJsonEditor from '@/components/ThemeConfigJsonEditor'

export default function DocsConfigPage() {
  return (
    <main className="main">
      <div className="container">
        <PageTitle
          title="Config JSON"
          subtitle="Single source of truth for runtime theme tokens."
          subtext="Changes from demos update this JSON. Editing this JSON updates the UI runtime."
        />
        <ThemeConfigJsonEditor />
      </div>
    </main>
  )
}
