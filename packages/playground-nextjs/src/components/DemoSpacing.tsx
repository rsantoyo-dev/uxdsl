'use client'

import { useState, useEffect } from 'react'

const MAX_LAYERS = 8
const spaces = Array.from({ length: MAX_LAYERS }, (_, i) => i + 1)

function RussianDoll({ spaceIndex }: { spaceIndex: number }) {
  if (spaceIndex < 1) return (
    <div className="doll-center">
      <span className="doll-label">Content</span>
    </div>
  )

  return (
    <div className={`doll-layer doll-layer--${spaceIndex}`}>
      <div className="doll-label-corner">space({spaceIndex})</div>
      <RussianDoll spaceIndex={spaceIndex - 1} />
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
          <RussianDoll spaceIndex={dollLevels} />
        </div>
      </div>

      <div className="spacing-grid-container">
         <h4 className="demo-subtitle">Token Reference (Editable)</h4>
         <div className="spacing-grid">
            {spaces.map(s => (
              <div key={s} className="spacing-card">
                <div className="spacing-card__token">space({s})</div>
                
                <div className="spacing-card__definition">
                  <input 
                    className="spacing-card__input"
                    value={computedValues[s] || ''}
                    onChange={(e) => handleSpaceChange(s, e.target.value)}
                    placeholder="e.g. 1rem"
                  />
                </div>

                <div className="spacing-card__preview">
                  <div className={`spacing-box spacing-box--${s}`} />
                </div>
              </div>
            ))}
         </div>
      </div>
    </section>
  )
}

