import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://uxdsl.vercel.app'
  
  // Core routes
  const routes = [
    '',
    '/docs/home',
    '/docs/quick-start',
    '/docs/palette',
    '/docs/typography',
    '/docs/densities',
    '/docs/breakpoints',
    '/docs/colors',
    '/docs/spacing',
    '/docs/surfaces',
    '/docs/buttons',
    '/docs/inputs',
    '/docs/borders',
    '/docs/shadows',
    '/docs/productivity',
  ]

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: route === '' ? 1 : 0.8,
  }))
}
