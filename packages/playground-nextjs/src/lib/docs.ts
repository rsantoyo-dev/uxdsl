export type NavLink = {
  href: string
  label: string
}

export function getDocsLinks(): NavLink[] {
  const pages = [
    'home',
    'quick-start',
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
    'productivity'
  ]

  return pages.map(name => ({
    href: `/docs/${name}`,
    label: name.charAt(0).toUpperCase() + name.slice(1)
  }))
}
