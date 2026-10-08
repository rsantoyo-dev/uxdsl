import type { Metadata } from 'next'
import './uxdsl.css'
import AppHeader from '@/components/AppHeader'
import PageToolbar from '@/components/PageToolbar'
import ThemeScript from '@/components/ThemeScript'
import { Providers } from '@/components/Providers'
import { themes } from '../../themes'
import { SITE_URL } from '@/lib/docs'
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const dynamic = 'force-dynamic'
export const revalidate = 0

const DESCRIPTION = 'UXDSL is CSS where breakpoints belong to the theme, not to your components. Spacing, type, color and roles are defined once in a theme JSON; components name them, and the compiler turns them into plain CSS and refuses any reference it cannot resolve.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'UXDSL — breakpoint-free components, responsive tokens',
    template: '%s | UXDSL',
  },
  description: DESCRIPTION,
  keywords: ['UXDSL', 'CSS', 'PostCSS', 'design tokens', 'design system', 'responsive design', 'theme JSON', 'breakpoints', 'CSS custom properties'],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'UXDSL',
    description: 'Breakpoint-free components. Responsive tokens.',
    url: SITE_URL,
    siteName: 'UXDSL',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/uxdsl-alpha.png',
        width: 448,
        height: 448,
        alt: 'UXDSL',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'UXDSL',
    description: 'Breakpoint-free components. Responsive tokens.',
    images: ['/uxdsl-alpha.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <ThemeScript theme={themes.default} />
      </head>
      <body className="ds-typo" data-typo="body">
        <Providers>
          <AppHeader />
          <PageToolbar />
          {children}
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
