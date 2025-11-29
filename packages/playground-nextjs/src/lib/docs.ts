import fs from 'fs'
import path from 'path'

export type NavLink = {
  href: string
  label: string
}

export function getDocsLinks(): NavLink[] {
  const docsDir = path.join(process.cwd(), 'src/app/docs')
  
  // If docs directory doesn't exist, return empty array
  if (!fs.existsSync(docsDir)) {
    return []
  }

  const items = fs.readdirSync(docsDir, { withFileTypes: true })

  const order = [
    'home',
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

  const links = items
    .filter(item => item.isDirectory())
    .map(item => {
      const name = item.name
      // Check if page.mdx or page.tsx exists
      const hasPage = fs.existsSync(path.join(docsDir, name, 'page.mdx')) ||
                      fs.existsSync(path.join(docsDir, name, 'page.tsx')) ||
                      fs.existsSync(path.join(docsDir, name, 'page.js')) ||
                      fs.existsSync(path.join(docsDir, name, 'page.jsx'))

      if (hasPage) {
        // Simple label generation: capitalize first letter
        // In the future, we could read frontmatter from the file
        const label = name.charAt(0).toUpperCase() + name.slice(1)
        return {
          href: `/docs/${name}`,
          label,
          key: name
        }
      }
      return null
    })
    .filter((link): link is NavLink & { key: string } => link !== null)
    .sort((a, b) => {
      const indexA = order.indexOf(a.key)
      const indexB = order.indexOf(b.key)
      
      // If both are in the order list, sort by index
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB
      }
      
      // If only A is in the list, it comes first
      if (indexA !== -1) return -1
      
      // If only B is in the list, it comes first
      if (indexB !== -1) return 1
      
      // Otherwise sort alphabetically
      return a.label.localeCompare(b.label)
    })

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return links.map(({ key, ...link }) => link)
}
