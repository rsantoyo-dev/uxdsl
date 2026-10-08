import { MetadataRoute } from 'next'
import { getDocsLinks, SITE_URL } from '@/lib/docs'

export default function sitemap(): MetadataRoute.Sitemap {
  // The home page and every page of the documentation's navigation, on the one canonical host.
  const routes = ['', ...getDocsLinks().map((link) => link.href)]

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: route === '' ? 1 : 0.8,
  }))
}
