'use client'


import styles from './RussianDoll.module.css'
import { scopedClasses } from '../lib/uxdsl-module-classes'
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
  const paddingStyle = { padding: `var(--uxdsl__density__${densityIndex})` }

  return (
    <div className={scopedClasses("concentric-wrapper", styles)} style={paddingStyle}>
      <div className={scopedClasses("concentric-content", styles)}>
        <span className={scopedClasses("concentric-label", styles)}>Content</span>
        
        {Array.from({ length: Math.max(0, densityIndex) }, (_, i) => i + 1).map(level => (
          <button type="button"
            key={level}
            className={scopedClasses(`concentric-ring concentric-ring--uxdsl__density__${level} ${hoveredLevel === level ? 'is-hovered' : ''}`, styles)}
            onMouseEnter={() => setHoveredLevel(level)}
            onMouseLeave={() => setHoveredLevel(null)}
            onClick={(e) => {
              if (onLayerClick) {
                e.stopPropagation()
                onLayerClick(level)
              }
            }}
            disabled={!onLayerClick}
            aria-label={`Edit density(${level})`}
            style={onLayerClick ? { cursor: 'pointer' } : undefined}
          >
            <span className={scopedClasses("ring-label", styles)}>density({level})</span>
          </button>
        ))}
      </div>
    </div>
  )
}
