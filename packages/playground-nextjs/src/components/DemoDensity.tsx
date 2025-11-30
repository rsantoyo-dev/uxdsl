'use client'

import { useState, useEffect } from 'react'
import { useBreakpoints, BreakpointKey } from '@/components/BreakpointsProvider'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

const MAX_LAYERS = 14
const densities = Array.from({ length: MAX_LAYERS }, (_, i) => i + 1)

const defaultDensities: Record<number, string> = {
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

// Order for display and logic
const BP_ORDER: BreakpointKey[] = ['xs', 'sm', 'md', 'lg', 'xl']

function EditDensityDialog({
  level,
  initialDefinition,
  onSave,
  onClose,
}: {
  level: number
  initialDefinition: string
  onSave: (def: string) => void
  onClose: () => void
}) {
  const [breakpointValues, setBreakpointValues] = useState<Record<string, string>>({})

  useEffect(() => {
    const values: Record<string, string> = {}
    const parts = initialDefinition.split(/\s+(?![^(]*\))/g).filter(Boolean)
    
    parts.forEach(part => {
      const openParen = part.indexOf('(')
      const closeParen = part.lastIndexOf(')')
      
      if (openParen > 0 && closeParen === part.length - 1) {
        const bp = part.substring(0, openParen)
        const val = part.substring(openParen + 1, closeParen)
        values[bp] = val
      }
    })

    setBreakpointValues(values)
  }, [initialDefinition])

  const handleSave = () => {
    const parts: string[] = []
    
    BP_ORDER.forEach(bp => {
      const rawVal = breakpointValues[bp]
      if (!rawVal || !rawVal.trim()) return
      parts.push(`${bp}(${rawVal.trim()})`)
    })

    onSave(parts.join(' '))
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
    }} onClick={onClose}>
      <div style={{
        background: 'var(--ds__palette__surface-main)', padding: '2rem', borderRadius: '8px',
        width: '400px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Edit Density {level}</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {BP_ORDER.map(bp => (
            <label key={bp} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ width: '30px', fontWeight: 'bold', opacity: 0.7 }}>{bp}</span>
              <input 
                type="text"
                value={breakpointValues[bp] || ''}
                onChange={e => setBreakpointValues(prev => ({ ...prev, [bp]: e.target.value }))}
                placeholder="e.g. space(2), 16px"
                style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} style={{ 
            padding: '0.5rem 1rem', background: 'var(--ds__palette__primary-main)', 
            color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' 
          }}>Save</button>
        </div>
      </div>
    </div>
  )
}

function parseDensityValue(value: string) {
  if (value.startsWith('space(') && value.endsWith(')')) {
    const spaceVal = value.slice(6, -1)
    return `var(--space-${spaceVal})`
  }
  return value
}

function generateCss(definitions: Record<number, string>, breakpoints: Record<string, number>) {
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
      css += `:root { --density-${level}: ${rules['xs']}; }\n`
    }

    Object.entries(rules).forEach(([bp, val]) => {
      if (bp === 'xs') return
      const width = breakpoints[bp]
      if (width) {
        css += `@media (min-width: ${width}px) {\n          :root { --density-${level}: ${val}; }\n        }\n`
      }
    })
  })

  return css
}

function RussianDoll({ densityIndex, onLayerClick }: { densityIndex: number, onLayerClick: (level: number) => void }) {
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
              e.stopPropagation()
              onLayerClick(level)
            }}
          >
            <span className="ring-label">density({level})</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function parseDefinitionForDisplay(def: string) {
  const parts = def.split(/\s+(?![^(]*\))/g).filter(Boolean)
  const result: Record<string, string> = {}
  parts.forEach(part => {
    const openParen = part.indexOf('(')
    const closeParen = part.lastIndexOf(')')
    
    if (openParen > 0 && closeParen === part.length - 1) {
      const bp = part.substring(0, openParen)
      const val = part.substring(openParen + 1, closeParen)
      result[bp] = val
    }
  })
  return result
}

function useBreakpoint(breakpoints: Record<string, number>) {
  const [bp, setBp] = useState('')

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      let current = 'xs'
      for (const [key, val] of Object.entries(breakpoints)) {
        if (width >= val) {
          current = key
        }
      }
      setBp(current)
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoints])

  return bp
}

function getActiveDefinition(def: string, currentBp: string) {
  const parsed = parseDefinitionForDisplay(def)
  let activeVal = parsed['xs'] || ''
  
  const currentBpIndex = BP_ORDER.indexOf(currentBp as BreakpointKey)
  
  for (let i = 0; i <= currentBpIndex; i++) {
    const bp = BP_ORDER[i]
    if (parsed[bp]) {
      activeVal = parsed[bp]
    }
  }
  
  return activeVal
}

export default function DemoDensity() {
  const { breakpoints } = useBreakpoints()
  const [dollLevels, setDollLevels] = useState(14)
  const [densityDefinitions, setDensityDefinitions] = useState(defaultDensities)
  const [editingLevel, setEditingLevel] = useState<number | null>(null)
  const currentBp = useBreakpoint(breakpoints)

  useEffect(() => {
    const styleId = 'demo-density-styles'
    let styleEl = document.getElementById(styleId)
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = generateCss(densityDefinitions, breakpoints)
  }, [densityDefinitions, breakpoints])

  const handleSaveDefinition = (def: string) => {
    if (editingLevel !== null) {
      setDensityDefinitions(prev => ({ ...prev, [editingLevel]: def }))
      setEditingLevel(null)
    }
  }

  return (
    <section id="DemoDensity" className="density-section demo-section">
      <div className="density-header">
        <p className="demo-subtitle">
          Density is a responsive unit linked to UXDSL spacing (or custom pixel values). 
          Using a single token like <code>density(1)</code> automatically adapts across breakpoints, 
          eliminating manual media queries reducing coding efforts
        </p>
      </div>

      <div className="density-doll-container">
        <h4 className="demo-subtitle">Russian Doll Visualization</h4>
        <div className="density-doll-controls">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Layers:
            <input
              type="range"
              min={1}
              max={MAX_LAYERS}
              value={dollLevels}
              onChange={(e) => setDollLevels(Number(e.target.value))}
              className="density-slider"
            />
            <span>{dollLevels}</span>
          </label>
        </div>
        <div className="density-doll-wrapper">
          <RussianDoll 
            densityIndex={dollLevels} 
            onLayerClick={(level) => setEditingLevel(level)}
          />
        </div>

        <div className="demo-code-block" style={{ marginTop: '2rem', width: '100%', maxWidth: '600px', margin: '2rem auto 0' }}>
          <div className="code-header">
            <span className="code-file">DensityUsage.uxdsl</span>
          </div>
          <SyntaxHighlighter 
            language="scss" 
            style={vscDarkPlus}
            customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.9rem' }}
            wrapLines={true}
          >
{`.any-class {
  padding: density(${dollLevels});
}`}
          </SyntaxHighlighter>
        </div>
      </div>

      <div className="demo-header" style={{ marginTop: '3rem', marginBottom: '1.5rem' }}>
        <h3 className="demo-title">Global Density Tokens</h3>
        <p className="demo-subtitle">
          Update the tokens below to reflect changes in the UI.
        </p>
      </div>

      <div className="density-grid-container">
        <div className="density-grid">
          {densities.map((s) => {
            const def = densityDefinitions[s]
            if (!def) return null
            const parsedDef = parseDefinitionForDisplay(def)
            // Sort breakpoints for consistent rendering order
            const sortedBps = Object.keys(parsedDef).sort((a, b) => {
              return BP_ORDER.indexOf(a as BreakpointKey) - BP_ORDER.indexOf(b as BreakpointKey)
            })

            const activeDef = getActiveDefinition(densityDefinitions[s], currentBp)

            // Determine active breakpoint key
            const currentBpIndex = BP_ORDER.indexOf(currentBp as BreakpointKey)
            let activeBpKey = 'xs'
            for (const bp of sortedBps) {
              if (BP_ORDER.indexOf(bp as BreakpointKey) <= currentBpIndex) {
                activeBpKey = bp
              }
            }

            return (
              <div key={s} className="density-card">
                                <div className="density-card__header">
                  {/* Col 1: Token & Active Rule */}
                  <div className="density-card__header-col density-card__header-col--main">
                    <div className="density-card__token">density({s})</div>
                    <div className="density-metric-value density-metric-value--highlight">{activeDef}</div>
                  </div>

                  {/* Col 2: Breakpoints (Stacked) */}
                  <div className="density-card__header-col density-card__header-col--bps">
                    <div className="density-def-list">
                      {sortedBps.map((bp) => (
                        <div 
                          key={bp} 
                          className={`density-def-item ${bp === activeBpKey ? 'density-def-item--active' : ''}`}
                        >
                          <span className="density-def-bp">{bp}:</span>
                          <span className="density-def-val">{parsedDef[bp]}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Col 3: Edit (Flex) */}
                  <div className="density-card__header-col density-card__header-col--right">
                    <button
                      className="density-card__edit-btn"
                      onClick={() => setEditingLevel(s)}
                    >
                      Edit
                    </button>
                  </div>
                </div>

                {/* Visualization Row */}
                <div className="density-card__viz">
                  <div className="density-concentric-viz">
                    {/* Center anchor */}
                    <div className="density-concentric-center" />
                    
                    {/* Concentric boxes */}
                    {sortedBps.map((bp, i) => {
                      const isActive = bp === activeBpKey
                      return (
                        <div 
                          key={bp} 
                          className={`density-concentric-box density-concentric-box--${i % 3} ${isActive ? 'density-concentric-box--active' : ''}`}
                          style={{ padding: parseDensityValue(parsedDef[bp]) }}
                          title={`${bp}: ${parsedDef[bp]}`}
                        >
                          {/* Inner div to define the content box size (matches center) */}
                          <div className="density-concentric-inner" />
                          <span className="density-concentric-label">{bp}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {editingLevel !== null && (
        <EditDensityDialog 
          level={editingLevel}
          initialDefinition={densityDefinitions[editingLevel]}
          onSave={handleSaveDefinition}
          onClose={() => setEditingLevel(null)}
        />
      )}
    </section>
  )
}
