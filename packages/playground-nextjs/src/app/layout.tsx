import type { Metadata } from 'next'
import './uxdsl.css'
import AppHeader from '@/components/AppHeader'
import PageToolbar from '@/components/PageToolbar'
import ThemeScript from '@/components/ThemeScript'
import { Providers } from '@/components/Providers'
import theme from '../../uxdsl.theme.default.json'
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  metadataBase: new URL('https://uxdsl.vercel.app'),
  title: {
    default: 'UX-DSL - Type-safe Design System Language',
    template: '%s | UX-DSL',
  },
  description: 'A type-safe, compile-time design system language that bridges the gap between design tokens and CSS implementation. Write expressive, token-aware styles that compile to optimized CSS.',
  keywords: ['Design System', 'CSS', 'TypeScript', 'UX', 'Design Tokens', 'Compiler', 'Style', 'Theme'],
  openGraph: {
    title: 'UX-DSL',
    description: 'Type-safe, compile-time design system language.',
    url: 'https://uxdsl.vercel.app',
    siteName: 'UX-DSL',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/uxdsl-alpha.png',
        width: 1200,
        height: 630,
        alt: 'UX-DSL Preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UX-DSL',
    description: 'Type-safe, compile-time design system language.',
    images: ['/uxdsl-alpha.png'],
    creator: '@rsantoyo', 
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
        <ThemeScript theme={theme} />
      </head>
      <body>
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
