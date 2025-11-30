import type { Metadata } from 'next'
import './uxdsl.css'
import AppHeader from '@/components/AppHeader'
import PageToolbar from '@/components/PageToolbar'
import ThemeScript from '@/components/ThemeScript'
import { Providers } from '@/components/Providers'
import theme from '../../uxdsl.theme.default.json'

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
  return (
    <html lang="en">
      <head>
        <ThemeScript theme={theme} />
      </head>
      <body>
        <Providers>
          <AppHeader />
          <PageToolbar />
          {children}
        </Providers>
      </body>
    </html>
  )
}
