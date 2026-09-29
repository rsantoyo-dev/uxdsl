'use client'


import styles from './DemoDensity.module.css'
import { scopedClasses } from '../lib/uxdsl-module-classes'
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
    <div className={scopedClasses("edit-dialog__backdrop", styles)} onClick={onClose}>
      <div className={scopedClasses("edit-dialog edit-dialog--scroll", styles)} onClick={e => e.stopPropagation()}>
        <h3 className={scopedClasses("edit-dialog__title", styles)}>Edit Density {level}</h3>

        <div className={scopedClasses("edit-dialog__fields", styles)}>
          {bpOrder.map(bp => (
            <label key={bp} className={scopedClasses("edit-dialog__row", styles)}>
              <span className={scopedClasses("edit-dialog__breakpoint", styles)}>{bp}</span>
              <input 
                type="text"
                value={breakpointValues[bp] || ''}
                onChange={e => setBreakpointValues(prev => ({ ...prev, [bp]: e.target.value }))}
                placeholder="e.g. space(2), 16px"
                className={scopedClasses("edit-dialog__input edit-dialog__input--grow", styles)}
              />
            </label>
          ))}
        </div>

        <div className={scopedClasses("edit-dialog__actions edit-dialog__actions--spaced", styles)}>
          <button onClick={onClose} className={scopedClasses("edit-dialog__cancel", styles)}>Cancel</button>
          <button onClick={handleSave} className={scopedClasses("edit-dialog__save", styles)}>Save</button>
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
    <section id="DemoDensity" className={scopedClasses('module-root', styles) + ' ' + scopedClasses("density-section demo-section", styles)}>
      {error && <p role="alert">{error}</p>}
      <div className={scopedClasses("density-header", styles)}>
        <p className={scopedClasses("demo-subtitle", styles)}>
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

      <div className={scopedClasses("density-doll-container", styles)}>
        <h4 className={scopedClasses("demo-subtitle", styles)}>Russian Doll Visualization</h4>
        <div className={scopedClasses("density-doll-controls", styles)}>
          <label className={scopedClasses("density-doll-controls__label", styles)}>
            Density level:
            <input
              type="range"
              min={1}
              max={MAX_LAYERS}
              value={dollLevels}
              onChange={(e) => setDollLevels(Number(e.target.value))}
              className={scopedClasses("density-slider", styles)}
            />
            <span>{dollLevels}</span>
          </label>
        </div>
        <p>Each ring compares a Density level measured from the same content. The rings are not nested component paddings added together. Click a ring to edit its token. This diagram responds to the main browser viewport.</p>
        <div className={scopedClasses("density-doll-wrapper", styles)}>
          <RussianDoll 
            densityIndex={dollLevels} 
            onLayerClick={(level) => setEditingLevel(level)}
          />
        </div>

        <div className={scopedClasses("demo-code-block demo-code-block--usage", styles)}>
          <div className={scopedClasses("code-header", styles)}>
            <span className={scopedClasses("code-file", styles)}>DensityUsage.uxdsl</span>
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

      <div className={scopedClasses("demo-header demo-header--tokens", styles)}>
        <h3 className={scopedClasses("demo-title", styles)}>Global Density Tokens</h3>
        <p className={scopedClasses("demo-subtitle", styles)}>
          Update the tokens below to reflect changes in the UI.
        </p>
      </div>

      <div className={scopedClasses("density-grid-container", styles)}>
        <div className={scopedClasses("density-grid", styles)}>
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
              <div key={s} className={scopedClasses("density-card", styles)}>
                                <div className={scopedClasses("density-card__header", styles)}>
                  {/* Col 1: Token & Active Rule */}
                  <div className={scopedClasses("density-card__header-col density-card__header-col--main", styles)}>
                    <div className={scopedClasses("density-card__token", styles)}>density({s})</div>
                    <div className={scopedClasses("density-metric-value density-metric-value--highlight", styles)}>{activeDef}</div>
                  </div>

                  {/* Col 2: Breakpoints (Stacked) */}
                  <div className={scopedClasses("density-card__header-col density-card__header-col--bps", styles)}>
                    <div className={scopedClasses("density-def-list", styles)}>
                      {sortedBps.map((bp) => (
                        <div 
                          key={bp} 
                          className={scopedClasses(`density-def-item ${bp === activeBpKey ? 'density-def-item--active' : ''}`, styles)}
                        >
                          <span className={scopedClasses("density-def-bp", styles)}>{bp}:</span>
                          <span className={scopedClasses("density-def-val", styles)}>{parsedDef[bp]}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Col 3: Edit (Flex) */}
                  <div className={scopedClasses("density-card__header-col density-card__header-col--right", styles)}>
                    <button
                      className={scopedClasses("density-card__edit-btn", styles)}
                      onClick={() => setEditingLevel(s)}
                    >
                      Edit
                    </button>
                  </div>
                </div>

                {/* Visualization Row */}
                <div className={scopedClasses("density-card__viz", styles)}>
                  <div className={scopedClasses("density-concentric-viz", styles)}>
                    {/* Center anchor */}
                    <div className={scopedClasses("density-concentric-center", styles)} />
                    
                    {/* Concentric boxes */}
                    {sortedBps.map((bp, i) => {
                      const isActive = bp === activeBpKey
                      return (
                        <div 
                          key={bp} 
                          className={scopedClasses(`density-concentric-box density-concentric-box--${i % 3} ${isActive ? 'density-concentric-box--active' : ''}`, styles)}
                          style={{ padding: parseDensityValue(parsedDef[bp]) }}
                          title={`${bp}: ${parsedDef[bp]}`}
                        >
                          {/* Inner div to define the content box size (matches center) */}
                          <div className={scopedClasses("density-concentric-inner", styles)} />
                          <span className={scopedClasses("density-concentric-label", styles)}>{bp}</span>
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
