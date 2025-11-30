'use client'

import { useState, useEffect } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

const MAX_LAYERS = 16
const spaces = Array.from({ length: MAX_LAYERS }, (_, i) => i + 1)

function EditSpacingDialog({
  level,
  initialValue,
  onSave,
  onClose,
}: {
  level: number
  initialValue: string
  onSave: (val: string) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(initialValue)

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
    }} onClick={onClose}>
      <div style={{
        background: 'var(--ds__palette__surface-main)', padding: '2rem', borderRadius: '8px',
        width: '400px', maxWidth: '90%', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Edit Space {level}</h3>
        
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Value</label>
          <input 
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="e.g. 1rem, 16px"
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
            autoFocus
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSave(value)} style={{ 
            padding: '0.5rem 1rem', background: 'var(--ds__palette__primary-main)', 
            color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' 
          }}>Save</button>
        </div>
      </div>
    </div>
  )
}

function ConcentricSpacing({ 
  maxLevel, 
  computedValues,
  onLayerClick 
}: { 
  maxLevel: number, 
  computedValues: Record<number, string>,
  onLayerClick: (level: number) => void
}) {
  const [hoveredLevel, setHoveredLevel] = useState<number | null>(null)
  
  // Calculate padding needed to contain the largest ring
  // The largest ring has inset: -space(maxLevel)
  // So we need padding equal to that space on the wrapper to prevent overflow
  const maxSpace = computedValues[maxLevel] || '0px'

  return (
    <div className="concentric-wrapper" style={{ padding: maxSpace }}>
      <div className="concentric-content">
        <span className="concentric-label">Content</span>
        
        {/* Render rings from largest to smallest so z-index stacking is natural? 
            Actually with absolute positioning and negative insets, we want larger ones behind.
            We can control z-index explicitly.
        */}
        {Array.from({ length: maxLevel }, (_, i) => i + 1).map(level => (
          <div 
            key={level}
            className={`concentric-ring concentric-ring--${level} ${hoveredLevel === level ? 'is-hovered' : ''}`}
            onMouseEnter={() => setHoveredLevel(level)}
            onMouseLeave={() => setHoveredLevel(null)}
            onClick={(e) => {
              e.stopPropagation()
              onLayerClick(level)
            }}
          >
            <span className="ring-label">space({level})</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DemoSpacing() {
  const [dollLevels, setDollLevels] = useState(15)
  const [computedValues, setComputedValues] = useState<Record<number, string>>({})
  const [editingLevel, setEditingLevel] = useState<number | null>(null)

  useEffect(() => {
    const style = getComputedStyle(document.documentElement)
    const values: Record<number, string> = {}
    spaces.forEach(s => {
      values[s] = style.getPropertyValue(`--space-${s}`).trim()
    })
    setComputedValues(values)
  }, [])

  const handleSpaceChange = (level: number, value: string) => {
    setComputedValues(prev => ({ ...prev, [level]: value }))
    document.documentElement.style.setProperty(`--space-${level}`, value)
  }

  const handleSaveDialog = (val: string) => {
    if (editingLevel !== null) {
      handleSpaceChange(editingLevel, val)
      setEditingLevel(null)
    }
  }

  return (
    <section id="DemoSpacing" className="spacing-section demo-section">
      <div className="spacing-header">
        <p className="demo-subtitle">
          Consistent spacing tokens for padding, margin, and layout gaps.
        </p>
      </div>

      <div className="spacing-doll-container">
        <h4 className="demo-subtitle">Concentric Spacing Visualization</h4>
        <div className="spacing-doll-controls">
           <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             Visible Rings: 
             <input 
               type="range" 
               min="1" 
               max={MAX_LAYERS} 
               value={dollLevels} 
               onChange={e => setDollLevels(Number(e.target.value))} 
             />
             <span>{dollLevels}</span>
           </label>
        </div>
        <div className="spacing-doll-wrapper">
          <ConcentricSpacing 
            maxLevel={dollLevels} 
            computedValues={computedValues} 
            onLayerClick={(level) => setEditingLevel(level)}
          />
        </div>

        <div className="demo-code-block" style={{ marginTop: '2rem', width: '100%', maxWidth: '600px', margin: '2rem auto 0' }}>
          <div className="code-header">
            <span className="code-file">SpacingUsage.uxdsl</span>
          </div>
          <SyntaxHighlighter 
            language="scss" 
            style={vscDarkPlus}
            customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.9rem' }}
            wrapLines={true}
          >
{`.any-class {
  padding: space(${dollLevels});
}`}
          </SyntaxHighlighter>
        </div>
      </div>

      <div className="demo-header" style={{ marginTop: '3rem', marginBottom: '1.5rem' }}>
        <h3 className="demo-title">Global Spacing Tokens</h3>
        <p className="demo-subtitle">
          Update the tokens below to reflect changes in the UI.
        </p>
      </div>

      <div className="spacing-grid-container">
         <div className="spacing-grid">
            {spaces.map(s => (
              <div key={s} className="spacing-card">
                <div className="spacing-card__token">space({s})</div>
                
                <div className="spacing-card__input-wrapper">
                  <input 
                    className="spacing-card__input"
                    value={computedValues[s] || ''}
                    onChange={(e) => handleSpaceChange(s, e.target.value)}
                    placeholder="e.g. 1rem"
                  />
                </div>
                
                <div className="spacing-card__separator" />

                <div className="spacing-card__preview">
                  <div className={`spacing-box spacing-box--${s}`} />
                </div>
              </div>
            ))}
         </div>
      </div>

      {editingLevel !== null && (
        <EditSpacingDialog 
          level={editingLevel}
          initialValue={computedValues[editingLevel] || ''}
          onSave={handleSaveDialog}
          onClose={() => setEditingLevel(null)}
        />
      )}
    </section>
  )
}

