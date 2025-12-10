'use client'

import { useState, useEffect } from 'react'
import { useBreakpoints, BreakpointKey } from '@/components/BreakpointsProvider'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

import { 
  RussianDoll, 
  generateDensityCss, 
  parseDensityValue, 
  DEFAULT_DENSITIES,
  MAX_LAYERS 
} from '@/components/RussianDoll'

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
    if (!initialDefinition) {
      setBreakpointValues({})
      return
    }

    const parts = initialDefinition.split(/\s+(?![^(]*\))/g).filter(Boolean)
    let hasMatches = false
    
    parts.forEach(part => {
      const openParen = part.indexOf('(')
      const closeParen = part.lastIndexOf(')')
      
      if (openParen > 0 && closeParen === part.length - 1) {
        const bp = part.substring(0, openParen)
        // Check if it's a valid breakpoint to distinguish from things like calc() or space()
        if (BP_ORDER.includes(bp as BreakpointKey)) {
          const val = part.substring(openParen + 1, closeParen)
          values[bp] = val
          hasMatches = true
        }
      }
    })

    // If no responsive pattern found, treat the whole string as the 'xs' (base) value
    if (!hasMatches && initialDefinition.trim()) {
      values['xs'] = initialDefinition.trim()
    }

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



function parseDefinitionForDisplay(def: string) {
  const parts = def.split(/\s+(?![^(]*\))/g).filter(Boolean)
  const result: Record<string, string> = {}
  let hasMatches = false

  parts.forEach(part => {
    const openParen = part.indexOf('(')
    const closeParen = part.lastIndexOf(')')
    
    if (openParen > 0 && closeParen === part.length - 1) {
      const bp = part.substring(0, openParen)
      if (BP_ORDER.includes(bp as BreakpointKey)) {
        const val = part.substring(openParen + 1, closeParen)
        result[bp] = val
        hasMatches = true
      }
    }
  })

  if (!hasMatches && def.trim()) {
    result['xs'] = def.trim()
  }

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
  const [densityDefinitions, setDensityDefinitions] = useState(DEFAULT_DENSITIES)
  const [editingLevel, setEditingLevel] = useState<number | null>(null)
  const currentBp = useBreakpoint(breakpoints)

  const densities = Array.from({ length: MAX_LAYERS }, (_, i) => i + 1)

  useEffect(() => {
    const styleId = 'demo-density-styles'
    let styleEl = document.getElementById(styleId)
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = generateDensityCss(densityDefinitions, breakpoints)
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
