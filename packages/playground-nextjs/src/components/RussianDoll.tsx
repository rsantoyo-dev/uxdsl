'use client'

import { useState } from 'react'

export const MAX_LAYERS = 14

export const DEFAULT_DENSITIES: Record<number, string> = {
  1: 'xs(space(1)) md(space(2)) xl(space(3))',
  2: 'xs(space(2)) md(space(3)) xl(space(4))',
  3: 'xs(space(3)) md(space(4)) xl(space(5))',
  4: 'xs(space(4)) md(space(5)) xl(space(6))',
  5: 'xs(space(5)) md(space(6)) xl(space(7))',
  6: 'xs(space(6)) md(space(7)) xl(space(8))',
  7: 'xs(space(7)) md(space(8)) xl(space(9))',
  8: 'xs(space(8)) md(space(9)) xl(space(10))',
  9: 'xs(space(9)) md(space(10)) xl(space(11))',
  10: 'xs(space(10)) md(space(11)) xl(space(12))',
  11: 'xs(space(11)) md(space(12)) xl(space(13))',
  12: 'xs(space(12)) md(space(13)) xl(space(14))',
  13: 'xs(space(13)) md(space(14)) xl(space(15))',
  14: 'xs(space(14)) md(space(15)) xl(space(16))',
}

export function parseDensityValue(value: string) {
  if (value.startsWith('space(') && value.endsWith(')')) {
    const spaceVal = value.slice(6, -1)
    return `var(--space-${spaceVal})`
  }
  return value
}

export function generateDensityCss(
  definitions: Record<number, string>, 
  breakpoints: Record<string, number>,
  selector: string = ':root',
  strategy: 'media' | 'container' = 'media'
) {
  let css = ''
  
  Object.entries(definitions).forEach(([level, def]) => {
    const parts = def.split(/\s+(?![^(]*\))/g).filter(Boolean)
    
    const rules: Record<string, string> = {}
    
    parts.forEach(part => {
      const openParen = part.indexOf('(')
      const closeParen = part.lastIndexOf(')')
      
      if (openParen > 0 && closeParen === part.length - 1) {
        const bp = part.substring(0, openParen)
        const val = part.substring(openParen + 1, closeParen)
        
        if (val) {
          rules[bp] = parseDensityValue(val)
        }
      }
    })

    if (rules['xs']) {
      css += `${selector} { --density-${level}: ${rules['xs']}; }\n`
    }

    Object.entries(rules).forEach(([bp, val]) => {
      if (bp === 'xs') return
      const width = breakpoints[bp]
      if (width) {
        if (strategy === 'container') {
          css += `@container (min-width: ${width}px) {\n          ${selector} { --density-${level}: ${val}; }\n        }\n`
        } else {
          css += `@media (min-width: ${width}px) {\n          ${selector} { --density-${level}: ${val}; }\n        }\n`
        }
      }
    })
  })

  return css
}

export function RussianDoll({ 
  densityIndex, 
  onLayerClick 
}: { 
  densityIndex: number, 
  onLayerClick?: (level: number) => void 
}) {
  const [hoveredLevel, setHoveredLevel] = useState<number | null>(null)
  const paddingStyle = { padding: `var(--density-${densityIndex})` }

  return (
    <div className="concentric-wrapper" style={paddingStyle}>
      <div className="concentric-content">
        <span className="concentric-label">Content</span>
        
        {Array.from({ length: Math.max(0, densityIndex) }, (_, i) => i + 1).map(level => (
          <div 
            key={level}
            className={`concentric-ring concentric-ring--density-${level} ${hoveredLevel === level ? 'is-hovered' : ''}`}
            onMouseEnter={() => setHoveredLevel(level)}
            onMouseLeave={() => setHoveredLevel(null)}
            onClick={(e) => {
              if (onLayerClick) {
                e.stopPropagation()
                onLayerClick(level)
              }
            }}
            style={onLayerClick ? { cursor: 'pointer' } : undefined}
          >
            <span className="ring-label">density({level})</span>
          </div>
        ))}
      </div>
    </div>
  )
}
