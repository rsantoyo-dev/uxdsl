'use client'

import { useState, useEffect } from 'react'

const MAX_LAYERS = 8
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
}

const breakpoints: Record<string, number> = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
}

const BREAKPOINT_KEYS = ['xs', 'sm', 'md', 'lg', 'xl']
type UnitType = 'space' | 'px' | 'rem'

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
  const [unitType, setUnitType] = useState<UnitType>('space')
  const [breakpointValues, setBreakpointValues] = useState<Record<string, string>>({})

  useEffect(() => {
    // Parse initial definition
    const values: Record<string, string> = {}
    let detectedUnit: UnitType = 'px' // Default fallback

    // Simple parser for "xs(val) sm(val)..."
    const parts = initialDefinition.split(/\s+(?![^(]*\))/g).filter(Boolean)
    
    parts.forEach(part => {
      const match = part.match(/^(\w+)\((.+)\)$/)
      if (match) {
        const [, bp, val] = match
        
        if (val.startsWith('space(')) {
          detectedUnit = 'space'
          values[bp] = val.replace(/^space\(|\)$/g, '')
        } else if (val.endsWith('rem')) {
          detectedUnit = 'rem'
          values[bp] = val.replace('rem', '')
        } else if (val.endsWith('px')) {
          detectedUnit = 'px'
          values[bp] = val.replace('px', '')
        } else {
          // Fallback or raw value
          values[bp] = val
        }
      }
    })

    setUnitType(detectedUnit)
    setBreakpointValues(values)
  }, [initialDefinition])

  const handleSave = () => {
    const parts: string[] = []
    
    BREAKPOINT_KEYS.forEach(bp => {
      const rawVal = breakpointValues[bp]
      if (!rawVal || !rawVal.trim()) return

      let finalVal = rawVal.trim()
      if (unitType === 'space') {
        finalVal = `space(${finalVal})`
      } else if (unitType === 'px') {
        finalVal = `${finalVal}px`
      } else if (unitType === 'rem') {
        finalVal = `${finalVal}rem`
      }

      parts.push(`${bp}(${finalVal})`)
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
        
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Unit Type</label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {(['space', 'px', 'rem'] as const).map(type => (
              <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="unitType" 
                  value={type} 
                  checked={unitType === type}
                  onChange={() => setUnitType(type)}
                />
                {type === 'space' ? 'Space System' : type.toUpperCase()}
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {BREAKPOINT_KEYS.map(bp => (
            <label key={bp} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ width: '30px', fontWeight: 'bold', opacity: 0.7 }}>{bp}</span>
              <input 
                type={unitType === 'space' ? 'number' : 'text'}
                value={breakpointValues[bp] || ''}
                onChange={e => setBreakpointValues(prev => ({ ...prev, [bp]: e.target.value }))}
                placeholder={unitType === 'space' ? 'Index (1-8)' : 'Value'}
                style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <span style={{ fontSize: '0.8rem', opacity: 0.5, width: '40px' }}>
                {unitType === 'space' ? '' : unitType}
              </span>
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
  // Handle space() function
  if (value.startsWith('space(') && value.endsWith(')')) {
    const spaceVal = value.slice(6, -1)
    return `var(--space-${spaceVal})`
  }
  return value
}

function generateCss(definitions: Record<number, string>) {
  let css = ''
  
  Object.entries(definitions).forEach(([level, def]) => {
    const parts = def.split(/\s+(?![^(]*\))/g).filter(Boolean) // Split by space but ignore spaces inside parens
    
    const rules: Record<string, string> = {}
    
    parts.forEach(part => {
      const match = part.match(/^(\w+)\((.+)\)$/)
      if (match) {
        const [, bp, val] = match
        rules[bp] = parseDensityValue(val)
      } else {
        // Assume xs/default if no breakpoint wrapper, or handle plain values
        rules['xs'] = parseDensityValue(part)
      }
    })

    // Generate CSS for this level
    // Base (xs)
    if (rules['xs']) {
      css += `:root { --density-${level}: ${rules['xs']}; }\n`
    }

    // Media queries
    Object.entries(rules).forEach(([bp, val]) => {
      if (bp === 'xs') return
      const width = breakpoints[bp]
      if (width) {
        css += `@media (min-width: ${width}px) {
          :root { --density-${level}: ${val}; }
        }\n`
      }
    })
  })

  return css
}

function RussianDoll({ densityIndex }: { densityIndex: number }) {
  if (densityIndex < 1) {
    return (
      <div className="doll-center">
        <span className="doll-label">Content</span>
      </div>
    )
  }

  return (
    <div className={`density-doll-layer density-doll-layer--${densityIndex}`}>
      <div className="doll-label-corner">density({densityIndex})</div>
      <RussianDoll densityIndex={densityIndex - 1} />
    </div>
  )
}

function parseDefinitionForDisplay(def: string) {
  const parts = def.split(/\s+(?![^(]*\))/g).filter(Boolean)
  const result: Record<string, string> = {}
  parts.forEach(part => {
    const match = part.match(/^(\w+)\((.+)\)$/)
    if (match) {
      const [, bp, val] = match
      result[bp] = val
    }
  })
  return result
}

const BP_ORDER = ['xs', 'sm', 'md', 'lg', 'xl', '2xl']

function useBreakpoint() {
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
  }, [])

  return bp
}

function getActiveDefinition(def: string, currentBp: string) {
  const parsed = parseDefinitionForDisplay(def)
  let activeVal = parsed['xs'] || ''
  
  // Find the largest breakpoint <= currentBp that has a definition
  const currentBpIndex = BP_ORDER.indexOf(currentBp)
  
  for (let i = 0; i <= currentBpIndex; i++) {
    const bp = BP_ORDER[i]
    if (parsed[bp]) {
      activeVal = parsed[bp]
    }
  }
  
  return activeVal
}

export default function DemoDensity() {
  const [dollLevels, setDollLevels] = useState(5)
  const [computedValues, setComputedValues] = useState<Record<number, string>>({})
  const [densityDefinitions, setDensityDefinitions] = useState(defaultDensities)
  const [editingLevel, setEditingLevel] = useState<number | null>(null)
  const currentBp = useBreakpoint()

  useEffect(() => {
    const styleId = 'demo-density-styles'
    let styleEl = document.getElementById(styleId)
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = generateCss(densityDefinitions)
  }, [densityDefinitions])

  useEffect(() => {
    const updateComputedValues = () => {
      const getComputedPadding = (level: number) => {
        // Use the hidden probe element to get the actual computed padding
        const el = document.querySelector(
          `.density-section .density-probe--${level}`,
        ) as HTMLElement | null
        if (!el) return ''
        return getComputedStyle(el).padding
      }

      const values: Record<number, string> = {}
      densities.forEach((s) => {
        values[s] = getComputedPadding(s)
      })
      setComputedValues(values)
    }

    // Use requestAnimationFrame to ensure styles are applied before measuring
    // Double rAF is a common trick to wait for the next paint
    requestAnimationFrame(() => {
      requestAnimationFrame(updateComputedValues)
    })
    
    window.addEventListener('resize', updateComputedValues)

    return () => {
      window.removeEventListener('resize', updateComputedValues)
    }
  }, [densityDefinitions]) // Re-run when definitions change

  const handleSaveDefinition = (def: string) => {
    if (editingLevel !== null) {
      setDensityDefinitions(prev => ({ ...prev, [editingLevel]: def }))
      setEditingLevel(null)
    }
  }

  return (
    <section className="density-section demo-section">
      <div className="density-header">
        <h3 className="demo-title">Density Scale</h3>
        <p className="demo-subtitle">
          Density is a responsive unit linked to UXDSL spacing (or custom pixel values). 
          Using a single token like <code>density(1)</code> automatically adapts across breakpoints, 
          eliminating manual media queries and reducing coding effort by 3x.
        </p>
        <div className="density-code-snippet">
          .any-class &#123; padding: density(1) &#125;
        </div>
      </div>

      <div className="density-doll-container">
        <h4 className="demo-subtitle">Russian Doll Visualization</h4>
        <div className="doll-controls">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Layers:
            <input
              type="range"
              min={1}
              max={MAX_LAYERS}
              value={dollLevels}
              onChange={(e) => setDollLevels(Number(e.target.value))}
            />
            <span>{dollLevels}</span>
          </label>
        </div>
        <div className="doll-wrapper">
          <RussianDoll densityIndex={dollLevels} />
        </div>
      </div>

      <div className="density-grid-container">
        <h4 className="demo-subtitle">Token Reference</h4>
        <div className="density-grid">
          {densities.map((s) => {
            const parsedDef = parseDefinitionForDisplay(densityDefinitions[s])
            // Sort breakpoints for consistent rendering order
            const sortedBps = Object.keys(parsedDef).sort((a, b) => {
              return BP_ORDER.indexOf(a) - BP_ORDER.indexOf(b)
            })

            const computedPx = computedValues[s] || ''
            const computedRem = computedPx ? `${parseFloat(computedPx) / 16}rem` : ''
            const activeDef = getActiveDefinition(densityDefinitions[s], currentBp)

            // Determine active breakpoint key
            const currentBpIndex = BP_ORDER.indexOf(currentBp)
            let activeBpKey = 'xs'
            for (const bp of sortedBps) {
              if (BP_ORDER.indexOf(bp) <= currentBpIndex) {
                activeBpKey = bp
              }
            }

            return (
              <div key={s} className="density-card">
                {/* Hidden probe for measuring computed styles */}
                <div className={`density-probe--${s} density-doll-layer--${s}`} style={{ display: 'none' }} />

                {/* Column 1: Token & Definitions */}
                <div className="density-card__col-def">
                  <div className="density-card__token">density({s})</div>
                  
                  <div className="density-def-list">
                    {sortedBps.map((bp) => (
                      <div key={bp} className="density-def-item">
                        <span className="density-def-bp">{bp}:</span>
                        <span className="density-def-val">{parsedDef[bp]}</span>
                      </div>
                    ))}
                  </div>
                  
                  <button
                    className="density-card__edit-btn"
                    onClick={() => setEditingLevel(s)}
                  >
                    Edit
                  </button>
                </div>

                {/* Column 2: Computed Values */}
                <div className="density-card__col-metrics">
                  <div className="density-metric-item">
                    <span className="density-metric-label">Active Rule</span>
                    <span className="density-metric-value density-metric-value--highlight">{activeDef}</span>
                  </div>
                  <div className="density-metric-item">
                    <span className="density-metric-label">Rem</span>
                    <span className="density-metric-value">{computedRem}</span>
                  </div>
                  <div className="density-metric-item">
                    <span className="density-metric-label">Px</span>
                    <span className="density-metric-value">{computedPx}</span>
                  </div>
                </div>

                {/* Column 3: Visualization */}
                <div className="density-card__col-viz">
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
