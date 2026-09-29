'use client'

import { useState, useEffect } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTheme } from './ThemeContext'
import styles from './DemoSpacing.module.css'
import spacingExplanationStyles from './SpacingExplanation.module.css'
import { scopedClasses } from '../lib/uxdsl-module-classes'

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
    <div className={styles['concentric-wrapper']} style={{ padding: maxSpace }}>
      <div className={styles['concentric-content']}>
        <span className="concentric-label">Content</span>
        
        {/* Render rings from largest to smallest so z-index stacking is natural? 
            Actually with absolute positioning and negative insets, we want larger ones behind.
            We can control z-index explicitly.
        */}
        {Array.from({ length: maxLevel }, (_, i) => i + 1).map(level => (
          <button type="button"
            key={level}
            className={`${styles['concentric-ring']} ${styles[`concentric-ring--${level}`]} ${hoveredLevel === level ? styles['is-hovered'] : ''}`}
            onMouseEnter={() => setHoveredLevel(level)}
            onMouseLeave={() => setHoveredLevel(null)}
            aria-label={`Edit space(${level})`}
            onClick={(e) => {
              e.stopPropagation()
              onLayerClick(level)
            }}
          >
            <span className={styles['ring-label']}>space({level})</span>
          </button>
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
  const [error, setError] = useState('')

  useEffect(() => {
    const style = getComputedStyle(document.documentElement)
    const values: Record<number, string> = {}
    spaces.forEach(s => {
      values[s] = style.getPropertyValue(`--uxdsl__space__${s}`).trim()
    })
    setComputedValues(values)
  }, [activeThemeData])

  const handleSpaceChange = (level: number, value: string) => {
    try {
      if (!CSS.supports('padding', value)) throw new Error(`Invalid spacing value: ${value}`)
      setCustomTheme(customThemeName || 'Custom Theme', { spacing: { [String(level)]: value } })
      setError('')
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setComputedValues(prev => ({ ...prev, [level]: activeThemeData?.spacing?.[String(level)] || '' }))
      return false
    }
  }

  const handleSaveDialog = (val: string) => {
    if (editingLevel !== null) {
      if (handleSpaceChange(editingLevel, val)) setEditingLevel(null)
    }
  }

  return (
    <section id="DemoSpacing" className={`${styles['spacing-section']} demo-section`}>
      <div className={styles['spacing-header']}>
        <p className="demo-subtitle">
          Edit a shared spacing token and see its consumers update together.
        </p>
      </div>

      <div className={scopedClasses('spacing-explanation', spacingExplanationStyles)}>
        <h3>Try it: one token, two paddings and a gap</h3>
        <p>This demonstration uses direct Spacing to show the base scale: these paddings and gaps intentionally keep a stable value across breakpoints. Prefer Density when building ordinary component spacing.</p>
        <p>The colored areas below use the page’s actual CSS variables. Edit <code>space(4)</code> to update both boxes and the gap between the action items.</p>
        <button type="button" className={scopedClasses('spacing-explanation__edit', spacingExplanationStyles)} onClick={() => setEditingLevel(4)}>Edit space(4)</button>
        <div className={scopedClasses('spacing-explanation__boxes', spacingExplanationStyles)}>
          {['Card', 'Panel'].map(name => <figure key={name}>
            <figcaption>{name}: <code>padding: space(4)</code></figcaption>
            <div className={scopedClasses('spacing-explanation__padding', spacingExplanationStyles)}><div className={scopedClasses('spacing-explanation__content', spacingExplanationStyles)}>Content</div></div>
          </figure>)}
          <figure><figcaption>Actions: <code>gap: space(4)</code></figcaption>
            <div className={scopedClasses('spacing-explanation__gap', spacingExplanationStyles)}><span className={scopedClasses('spacing-explanation__content', spacingExplanationStyles)}>First</span><span className={scopedClasses('spacing-explanation__content', spacingExplanationStyles)}>Second</span></div>
          </figure>
        </div>
        <p>These edits update the playground’s active browser theme. Other UI using the token may also change. They do not write to your source JSON file. The reference examples above stay unchanged.</p>
      </div>

      <div className={styles['spacing-doll-container']}>
        <h4 className="demo-subtitle">Concentric Spacing Visualization</h4>
        <p>Each ring shows a spacing level measured from the same content. These are alternative distances, not nested paddings added together. Click a ring to edit its token, or use the labeled token fields below. Custom values determine ring size; token numbers alone do not guarantee size order.</p>
        <div className={styles['spacing-doll-controls']}>
           <label className={styles['spacing-doll-controls__label']}>
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
        <div className={styles['spacing-doll-wrapper']}>
          <ConcentricSpacing 
            maxLevel={dollLevels} 
            computedValues={computedValues} 
            onLayerClick={(level) => setEditingLevel(level)}
          />
        </div>

        <div className={`demo-code-block ${styles['demo-code-block--usage']}`}>
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

      <div className={`demo-header ${styles['demo-header--tokens']}`}>
        <h3 className="demo-title">Global Spacing Tokens</h3>
        <p className="demo-subtitle">
          Update the tokens below to reflect changes in the UI.
        </p>
      </div>
      {error && <p role="alert">{error}</p>}

      <div className="spacing-grid-container">
         <div className={styles['spacing-grid']}>
            {spaces.map(s => (
              <div key={s} className={styles['spacing-card']}>
                <div className={styles['spacing-card__token']}>space({s})</div>
                
                <div className={styles['spacing-card__input-wrapper']}>
                  <input 
                    className={styles['spacing-card__input']}
                    aria-label={`Value for space(${s})`}
                    value={computedValues[s] || ''}
                    onChange={(e) => setComputedValues(prev => ({ ...prev, [s]: e.target.value }))}
                    onBlur={(e) => handleSpaceChange(s, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    placeholder="e.g. 1rem"
                  />
                </div>
                
                <div className={styles['spacing-card__separator']} />

                <div className={styles['spacing-card__preview']}>
                  <div className={`${styles['spacing-box']} ${styles[`spacing-box--${s}`]}`} />
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
