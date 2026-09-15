'use client'

import { useState, useEffect } from 'react'
import { useBreakpoints } from '@/components/BreakpointsProvider'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { responsiveEntries, resolveResponsiveValue, inspectResponsiveValue, getDensityTokens } from 'postcss-uxdsl/language'
import { useTheme } from './ThemeContext'
import DensityExplanation from './DensityExplanation'

import { 
  RussianDoll, 
  generateDensityCss, 
  parseDensityValue, 
  MAX_LAYERS 
} from '@/components/RussianDoll'


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
  const { breakpoints } = useBreakpoints()
  const bpOrder = Object.keys(breakpoints).sort((a,b) => breakpoints[a] - breakpoints[b])
  const [breakpointValues, setBreakpointValues] = useState<Record<string, string>>({})
  useEffect(() => { setBreakpointValues(responsiveEntries(initialDefinition || '', breakpoints)) }, [initialDefinition, breakpoints])

  const handleSave = () => {
    const parts: string[] = []
    
    bpOrder.forEach(bp => {
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
        background: 'var(--uxdsl__palette__surface-main)', padding: '2rem', borderRadius: '8px',
        width: '400px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Edit Density {level}</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {bpOrder.map(bp => (
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
            padding: '0.5rem 1rem', background: 'var(--uxdsl__palette__primary-main)', 
            color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' 
          }}>Save</button>
        </div>
      </div>
    </div>
  )
}



function useBreakpoint(breakpoints: Record<string, number>) {
  const [bp, setBp] = useState('')

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      const current = inspectResponsiveValue('', width, breakpoints).active || ''
      setBp(current)
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoints])

  return bp
}

export default function DemoDensity() {
  const { breakpoints } = useBreakpoints()
  const { activeThemeData } = useTheme()
  const bpOrder = Object.keys(breakpoints).sort((a,b) => breakpoints[a]-breakpoints[b])
  const [error, setError] = useState('')
  const [dollLevels, setDollLevels] = useState(4)
  const [densityDefinitions, setDensityDefinitions] = useState(() => getDensityTokens(activeThemeData))
  const [editingLevel, setEditingLevel] = useState<number | null>(null)
  const currentBp = useBreakpoint(breakpoints)

  useEffect(() => { setDensityDefinitions(getDensityTokens(activeThemeData)); setError('') }, [activeThemeData])

  const densities = Array.from({ length: MAX_LAYERS }, (_, i) => i + 1)

  useEffect(() => {
    const styleId = 'demo-density-styles'
    let styleEl = document.getElementById(styleId)
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = generateDensityCss(densityDefinitions, breakpoints, '#DemoDensity')
    return () => styleEl?.remove()
  }, [densityDefinitions, breakpoints])

  const handleSaveDefinition = (def: string) => {
    if (editingLevel !== null) {
      try {
        const next = { ...densityDefinitions, [editingLevel]: def }
        generateDensityCss(next, breakpoints)
        setDensityDefinitions(next); setEditingLevel(null); setError('')
      } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    }
  }

  return (
    <section id="DemoDensity" className="density-section demo-section">
      {error && <p role="alert">{error}</p>}
      <div className="density-header">
        <p className="demo-subtitle">
          Spacing defines a value; Density defines how spacing responds to the viewport.
          Prefer <code>density(n)</code> for component spacing using the theme’s responsive mapping.
          Use <code>space(n)</code> directly when a stable value across breakpoints is intentional.
          Changing that mapping updates every consumer of the token without changing component code.
        </p>
        <ol>
          <li>Define how a spacing token changes across breakpoints in your theme JSON.</li>
          <li>Use that Density token wherever components should share the same responsive spacing.</li>
          <li>Edit one mapping below and watch both connected boxes update together.</li>
        </ol>
        <p>Density is the recommended default for component spacing. Standard CSS remains available when finer control is needed. The generated media queries belong to the system; they are not removed from CSS.</p>
      </div>

      <DensityExplanation definition={densityDefinitions[4]} onEdit={() => setEditingLevel(4)} />

      <div className="density-doll-container">
        <h4 className="demo-subtitle">Russian Doll Visualization</h4>
        <div className="density-doll-controls">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Density level:
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
        <p>Each ring compares a Density level measured from the same content. The rings are not nested component paddings added together. Click a ring to edit its token. This diagram responds to the main browser viewport.</p>
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
            const parsedDef = responsiveEntries(def, breakpoints)
            // Sort breakpoints for consistent rendering order
            const sortedBps = Object.keys(parsedDef).sort((a, b) => {
              return bpOrder.indexOf(a) - bpOrder.indexOf(b)
            })

            const activeDef = resolveResponsiveValue(densityDefinitions[s], currentBp, breakpoints)

            // Determine active breakpoint key
            const currentBpIndex = bpOrder.indexOf(currentBp)
            let activeBpKey = 'xs'
            for (const bp of sortedBps) {
              if (bpOrder.indexOf(bp) <= currentBpIndex) {
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
