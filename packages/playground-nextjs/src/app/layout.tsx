import type { Metadata } from 'next'
import './uxdsl.css'
import AppHeader from '@/components/AppHeader'
import SideNav from '@/components/SideNav'
import ThemeScript from '@/components/ThemeScript'
import { Providers } from '@/components/Providers'
import theme from '../../uxdsl.theme.green.json'
import { getDocsLinks } from '@/lib/docs'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'UXDSL Next.js Playground',
  description: 'Next.js playground with UXDSL styling',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const docsLinks = getDocsLinks()

  return (
    <html lang="en">
      <head>
        <ThemeScript theme={theme} />
      </head>
      <body>
        <Providers>
          <AppHeader />
          <div className="layout">
            <aside className="layout__nav">
              <SideNav docsLinks={docsLinks} />
            </aside>
            <div className="layout__content">
              {children}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  )
}
