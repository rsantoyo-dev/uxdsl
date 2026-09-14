'use client'

import { useState, useEffect } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import runtime from 'postcss-uxdsl/ds-runtime'
import { useTheme } from './ThemeContext'
import styles from './SpacingExplanation.module.css'

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
          <label htmlFor="edit-spacing-value" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Value</label>
          <input 
            id="edit-spacing-value"
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
  const { activeThemeData, setCustomTheme, customThemeName } = useTheme()
  const [dollLevels, setDollLevels] = useState(4)
  const [computedValues, setComputedValues] = useState<Record<number, string>>({})
  const [editingLevel, setEditingLevel] = useState<number | null>(null)

  useEffect(() => {
    try {
      runtime.loadPersistedSpacing()
    } catch {}

    const style = getComputedStyle(document.documentElement)
    const values: Record<number, string> = {}
    spaces.forEach(s => {
      values[s] = style.getPropertyValue(`--space-${s}`).trim()
    })
    setComputedValues(values)
  }, [])

  const handleSpaceChange = (level: number, value: string) => {
    setComputedValues(prev => ({ ...prev, [level]: value }))
    try {
      runtime.updateSpacing(level, value, { persist: true })
    } catch {
      document.documentElement.style.setProperty(`--space-${level}`, value)
    }

    // Keep JSON theme model aligned with runtime token updates.
    const nextTheme = JSON.parse(JSON.stringify(activeThemeData || {}))
    if (!nextTheme.spacing) nextTheme.spacing = {}
    nextTheme.spacing[String(level)] = value
    setCustomTheme(customThemeName || 'Custom Theme', nextTheme)
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
          Edit a shared spacing token and see its consumers update together.
        </p>
      </div>

      <div className={styles.explanation}>
        <h3>Try it: one token, two paddings and a gap</h3>
        <p>This demonstration uses direct Spacing to show the base scale: these paddings and gaps intentionally keep a stable value across breakpoints. Prefer Density when building ordinary component spacing.</p>
        <p>The colored areas below use the page’s actual CSS variables. Edit <code>space(4)</code> to update both boxes and the gap between the action items.</p>
        <button type="button" className={styles.edit} onClick={() => setEditingLevel(4)}>Edit space(4)</button>
        <div className={styles.boxes}>
          {['Card', 'Panel'].map(name => <figure key={name}>
            <figcaption>{name}: <code>padding: space(4)</code></figcaption>
            <div className={styles.padding}><div className={styles.content}>Content</div></div>
          </figure>)}
          <figure><figcaption>Actions: <code>gap: space(4)</code></figcaption>
            <div className={styles.gap}><span className={styles.content}>First</span><span className={styles.content}>Second</span></div>
          </figure>
        </div>
        <p>These edits update the playground’s custom theme and persist spacing overrides in this browser when storage is available. Other UI using the token may also change. They do not write to your source JSON file. The reference examples above stay unchanged.</p>
      </div>

      <div className="spacing-doll-container">
        <h4 className="demo-subtitle">Concentric Spacing Visualization</h4>
        <p>Each ring shows a spacing level measured from the same content. These are alternative distances, not nested paddings added together. Click a ring to edit its token, or use the labeled token fields below. Custom values determine ring size; token numbers alone do not guarantee size order.</p>
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
                    aria-label={`Value for space(${s})`}
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
