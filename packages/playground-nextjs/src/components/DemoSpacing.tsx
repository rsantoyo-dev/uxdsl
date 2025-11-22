'use client'

import { useState, useEffect } from 'react'

const MAX_LAYERS = 8
const spaces = Array.from({ length: MAX_LAYERS }, (_, i) => i + 1)

function RussianDoll({ level, max }: { level: number, max: number }) {
  if (level > max) return (
    <div className="doll-center">
      <span className="doll-label">Content</span>
    </div>
  )

  return (
    <div className={`doll-layer doll-layer--${level}`}>
      <div className="doll-label-corner">space({level})</div>
      <RussianDoll level={level + 1} max={max} />
    </div>
  )
}

export default function DemoSpacing() {
  const [dollLevels, setDollLevels] = useState(5)
  const [computedValues, setComputedValues] = useState<Record<number, string>>({})

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

  return (
    <section className="spacing-section demo-section">
      <div className="spacing-header">
        <h3 className="demo-title">Spacing Scale</h3>
        <p className="demo-subtitle">
          Consistent spacing tokens for padding, margin, and layout gaps.
        </p>
      </div>

      <div className="spacing-doll-container">
        <h4 className="demo-subtitle">Russian Doll Visualization</h4>
        <div className="doll-controls">
           <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             Layers: 
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
        <div className="doll-wrapper">
          <RussianDoll level={1} max={dollLevels} />
        </div>
      </div>

      <div className="spacing-grid-container">
         <h4 className="demo-subtitle">Token Reference (Editable)</h4>
         <div className="spacing-grid">
            {spaces.map(s => (
              <div key={s} className="spacing-card">
                <div className="spacing-card__preview">
                  <div className={`spacing-box spacing-box--${s}`} />
                </div>
                <div className="spacing-card__label">space({s})</div>
                <input 
                  className="spacing-card__input"
                  value={computedValues[s] || ''}
                  onChange={(e) => handleSpaceChange(s, e.target.value)}
                  placeholder="e.g. 1rem"
                />
              </div>
            ))}
         </div>
      </div>
    </section>
  )
}

