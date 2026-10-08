export type NavLink = {
  href: string
  label: string
}

export type NavSection = {
  title: string
  links: NavLink[]
}

// The documentation, in reading order. Every page of the site that is not the home page
// is listed here exactly once; the sitemap and the side navigation both read this list.
export const DOCS_SECTIONS: NavSection[] = [
  {
    title: 'Start',
    links: [
      { href: '/docs/introduction', label: 'Introduction' },
      { href: '/docs/quick-start', label: 'Quick start' },
    ],
  },
  {
    title: 'Reference',
    links: [
      { href: '/docs/language', label: 'Language' },
      { href: '/docs/theme', label: 'Theme' },
    ],
  },
  {
    title: 'Tokens',
    links: [
      { href: '/docs/breakpoints', label: 'Breakpoints' },
      { href: '/docs/spacing', label: 'Spacing & density' },
      { href: '/docs/colors', label: 'Colors & palette' },
      { href: '/docs/typography', label: 'Typography' },
      { href: '/docs/borders', label: 'Borders & radii' },
      { href: '/docs/shadows', label: 'Shadows' },
    ],
  },
  {
    title: 'Roles',
    links: [
      { href: '/docs/surfaces', label: 'Surfaces' },
      { href: '/docs/buttons', label: 'Buttons' },
      { href: '/docs/inputs', label: 'Inputs' },
    ],
  },
  {
    title: 'Tools',
    links: [
      { href: '/docs/runtime', label: 'Runtime' },
      { href: '/docs/tooling', label: 'Tooling' },
      { href: '/docs/diagnostics', label: 'Diagnostics' },
      { href: '/docs/accessibility', label: 'Accessibility' },
      { href: '/docs/for-ai-agents', label: 'For AI agents' },
    ],
  },
]

export function getDocsSections(): NavSection[] {
  return DOCS_SECTIONS
}

export function getDocsLinks(): NavLink[] {
  return DOCS_SECTIONS.flatMap((section) => section.links)
}

export const SITE_URL = 'https://uxdsl.io'
export const GITHUB_URL = 'https://github.com/rsantoyo-dev/uxdsl'
export const NPM_URL = 'https://www.npmjs.com/package/uxdsl'
