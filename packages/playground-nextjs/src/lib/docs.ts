export type NavLink = {
  href: string
  label: string
}

// Pages whose label is not their capitalized path segment.
const LABELS: Record<string, string> = {
  cli: 'CLI',
}

export function getDocsLinks(): NavLink[] {
  const pages = [
    'home',
    'quick-start',
    'config',
    'breakpoints',
    'colors',
    'palette',
    'spacing',
    'densities',
    'typography',
    'borders',
    'shadows',
    'surfaces',
    'buttons',
    'inputs',
    'productivity',
    // MIG-B7-17 phase C: the tools themselves, called for real.
    'runtime',
    'contrast',
    'cli',
    'diagnostics',
  ]

  return pages.map(name => ({
    href: `/docs/${name}`,
    label: LABELS[name] ?? name.charAt(0).toUpperCase() + name.slice(1)
  }))
}
