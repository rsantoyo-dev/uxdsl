'use client'

import { useState, useEffect } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTheme } from './ThemeContext'

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
    <div className="edit-dialog__backdrop" onClick={onClose}>
      <div className="edit-dialog" onClick={e => e.stopPropagation()}>
        <h3 className="edit-dialog__title">Edit Space {level}</h3>

        <div className="edit-dialog__field">
          <label htmlFor="edit-spacing-value" className="edit-dialog__label">Value</label>
          <input 
            id="edit-spacing-value"
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="e.g. 1rem, 16px"
            className="edit-dialog__input edit-dialog__input--full"
            autoFocus
          />
        </div>

        <div className="edit-dialog__actions">
          <button onClick={onClose} className="edit-dialog__cancel">Cancel</button>
          <button onClick={() => onSave(value)} className="edit-dialog__save">Save</button>
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
    const style = getComputedStyle(document.documentElement)
    const values: Record<number, string> = {}
    spaces.forEach(s => {
      values[s] = style.getPropertyValue(`--uxdsl__space__${s}`).trim()
    })
    setComputedValues(values)
  }, [])

  const handleSpaceChange = (level: number, value: string) => {
    setComputedValues(prev => ({ ...prev, [level]: value }))
    // The theme JSON is the model: ThemeContext applies it through applyTheme,
    // which replaces the managed stylesheet's custom property.
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

      <div className="spacing-explanation">
        <h3>Try it: one token, two paddings and a gap</h3>
        <p>This demonstration uses direct Spacing to show the base scale: these paddings and gaps intentionally keep a stable value across breakpoints. Prefer Density when building ordinary component spacing.</p>
        <p>The colored areas below use the page’s actual CSS variables. Edit <code>space(4)</code> to update both boxes and the gap between the action items.</p>
        <button type="button" className="spacing-explanation__edit" onClick={() => setEditingLevel(4)}>Edit space(4)</button>
        <div className="spacing-explanation__boxes">
          {['Card', 'Panel'].map(name => <figure key={name}>
            <figcaption>{name}: <code>padding: space(4)</code></figcaption>
            <div className="spacing-explanation__padding"><div className="spacing-explanation__content">Content</div></div>
          </figure>)}
          <figure><figcaption>Actions: <code>gap: space(4)</code></figcaption>
            <div className="spacing-explanation__gap"><span className="spacing-explanation__content">First</span><span className="spacing-explanation__content">Second</span></div>
          </figure>
        </div>
        <p>These edits update the playground’s custom theme and persist spacing overrides in this browser when storage is available. Other UI using the token may also change. They do not write to your source JSON file. The reference examples above stay unchanged.</p>
      </div>

      <details className="demo-disclosure">
      <summary className="demo-disclosure__summary">Every spacing token ({spaces.length}): as rings, and as editable fields</summary>
      <div className="spacing-doll-container">
        <h4 className="demo-subtitle">Concentric Spacing Visualization</h4>
        <p>Each ring shows a spacing level measured from the same content. These are alternative distances, not nested paddings added together. Click a ring to edit its token, or use the labeled token fields below. Custom values determine ring size; token numbers alone do not guarantee size order.</p>
        <div className="spacing-doll-controls">
           <label className="spacing-doll-controls__label">
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

        <div className="demo-code-block demo-code-block--usage">
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
      </details>

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
