import SideNav from '@/components/SideNav'
import { getDocsSections } from '@/lib/docs'

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="layout">
      <SideNav sections={getDocsSections()} />
      <div className="layout__content">
        {children}
      </div>
    </div>
  )
}
