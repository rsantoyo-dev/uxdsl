import SideNav from '@/components/SideNav'
import { getDocsLinks } from '@/lib/docs'

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const docsLinks = getDocsLinks()

  return (
    <div className="layout">
      <SideNav docsLinks={docsLinks} />
      <div className="layout__content">
        {children}
      </div>
    </div>
  )
}
