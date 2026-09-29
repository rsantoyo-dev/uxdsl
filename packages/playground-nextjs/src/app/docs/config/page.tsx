import { PageTitle } from '@/components/PageTitle'
import ThemeConfigJsonEditor from '@/components/ThemeConfigJsonEditor'

export default function DocsConfigPage() {
  return (
    <main className="main">
      <div className="container">
        <PageTitle
          title="Config JSON"
          subtitle="Inspect and edit the theme currently applied in this playground."
          subtext="Changes from demos appear here. Edits update the browser preview; export JSON to save them to a project."
        />
        <ThemeConfigJsonEditor />
      </div>
    </main>
  )
}
