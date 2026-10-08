import { PageTitle } from '@/components/PageTitle'
import ThemeConfigJsonEditor from '@/components/ThemeConfigJsonEditor'

export const metadata = { title: 'Theme' }

export default function DocsThemePage() {
  return (
    <>
      <PageTitle
        title="Theme"
        subtitle="One JSON holds every design decision; the build, the runtime and the audits read it."
      />
      <ThemeConfigJsonEditor />
    </>
  )
}
