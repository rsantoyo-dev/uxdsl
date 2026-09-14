'use client'

import { useState } from 'react'
export { generateDensityCss, spacingValueToCss as parseDensityValue, DEFAULT_DENSITIES } from 'postcss-uxdsl/language'

export const MAX_LAYERS = 14

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
