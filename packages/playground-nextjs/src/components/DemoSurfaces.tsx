'use client'

import { useState, useEffect } from 'react'

// Default definitions based on default-surfaces.uxdsl
const defaultSurfaces = {
  'contained': {
    description: 'High emphasis surface with shadow and background color. Used for cards, modals, and floating elements.',
    padding: 'density(2)',
    radius: 'radius(2)',
    bg: 'palette(surface-main)',
    color: 'palette(surface-contrast)',
    border: '1px solid palette(surface-dark)',
    shadow: 'shadow(1)'
  },
  'outlined': {
    description: 'Medium emphasis surface with border and transparent background. Used for secondary cards and bordered sections.',
    padding: 'density(2)',
    radius: 'radius(2)',
    bg: 'transparent',
    color: 'palette(surface-contrast)',
    border: '1px solid palette(neutral-main)',
    shadow: 'none'
  },
  'flat': {
    description: 'Low emphasis surface with no border or shadow. Used for simple containers or transparent wrappers.',
    padding: 'density(2)',
    radius: 'radius(2)',
    bg: 'transparent',
    color: 'palette(surface-contrast)',
    border: 'none',
    shadow: 'none'
  }
}

type SurfaceKey = keyof typeof defaultSurfaces
type SurfaceProps = typeof defaultSurfaces['contained']

function resolveValue(val: string) {
  if (!val) return ''
  
  // Simple resolver for demo purposes
  return val
    .replace(/palette\(([^)]+)\)/g, (_, p1) => {
      // Handle opacity: palette(color, 0.5)
      const [token, opacity] = p1.split(',').map((s: string) => s.trim())
      if (opacity) {
        const percentage = parseFloat(opacity) * 100
        return `color-mix(in srgb, var(--ds__palette__${token}) ${percentage}%, transparent)`
      }
      return `var(--ds__palette__${token})`
    })
    .replace(/density\(([^)]+)\)/g, 'var(--density-$1)')
    .replace(/radius\(([^)]+)\)/g, 'var(--radius-$1)')
    .replace(/shadow\(([^)]+)\)/g, 'var(--shadow-$1)')
    .replace(/border\(([^)]+)\)/g, 'var(--border-$1)') // Assuming border mixin exists or just raw
}

function generateCss(surfaces: typeof defaultSurfaces) {
  let css = ''
  Object.entries(surfaces).forEach(([key, props]) => {
    css += `.demo-surface-${key} {
      padding: ${resolveValue(props.padding)};
      border-radius: ${resolveValue(props.radius)};
      background: ${resolveValue(props.bg)};
      color: ${resolveValue(props.color)};
      border: ${resolveValue(props.border)};
      box-shadow: ${resolveValue(props.shadow)};
    }\n`
  })
  return css
}

function EditSurfaceDialog({
  surfaceKey,
  initialProps,
  onSave,
  onClose,
}: {
  surfaceKey: string
  initialProps: SurfaceProps
  onSave: (props: SurfaceProps) => void
  onClose: () => void
}) {
  const [props, setProps] = useState(initialProps)

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
    }} onClick={onClose}>
      <div style={{
        background: 'var(--ds__palette__surface-main)', padding: '2rem', borderRadius: '8px',
        width: '500px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Edit Surface: {surfaceKey}</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {Object.entries(props).map(([key, val]) => (
            <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontWeight: 'bold', opacity: 0.7, fontSize: '0.9rem' }}>{key}</span>
              <input 
                type="text"
                value={val}
                onChange={e => setProps(prev => ({ ...prev, [key]: e.target.value }))}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSave(props)} style={{ 
            padding: '0.5rem 1rem', background: 'var(--ds__palette__primary-main)', 
            color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' 
          }}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default function DemoSurfaces() {
  const [surfaces, setSurfaces] = useState(defaultSurfaces)
  const [editingKey, setEditingKey] = useState<SurfaceKey | null>(null)

  useEffect(() => {
    const styleId = 'demo-surfaces-styles'
    let styleEl = document.getElementById(styleId)
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = generateCss(surfaces)
  }, [surfaces])

  const handleSave = (newProps: SurfaceProps) => {
    if (editingKey) {
      setSurfaces(prev => ({ ...prev, [editingKey]: newProps }))
      setEditingKey(null)
    }
  }

  const [playgroundVariant, setPlaygroundVariant] = useState<'contained' | 'outlined' | 'flat'>('contained')
  const [playgroundTone, setPlaygroundTone] = useState<string>('primary')
  const [playgroundSize, setPlaygroundSize] = useState<number>(2)

  // Compute playground class based on mixin logic
  const playgroundClass = `surface-playground__box--${playgroundVariant}-${playgroundTone}-${playgroundSize}`

  const mixinCode = `@ds-surface(${playgroundVariant} ${playgroundTone !== 'none' ? playgroundTone : ''} ${playgroundSize})`

  return (
    <section className="surfaces-section demo-section">
      <div className="surfaces-header">
        <h3 className="demo-title">Surfaces</h3>
        <p className="demo-subtitle">
          Surfaces are composite tokens that define background, border, shadow, and spacing properties.
          They provide consistent container styles across the application.
        </p>
        <div className="density-code-snippet">
          .card &#123; @ds-surface(contained) &#125;
        </div>
      </div>

      <div className="surfaces-playground-container">
        <h4 className="demo-subtitle">Interactive Playground</h4>
        <div className="surface-playground">
          <div className="surface-playground__controls">
            <label>
              <span>Variant</span>
              <select 
                value={playgroundVariant} 
                onChange={e => setPlaygroundVariant(e.target.value as 'contained' | 'outlined' | 'flat')}
              >
                <option value="contained">Contained</option>
                <option value="outlined">Outlined</option>
                <option value="flat">Flat</option>
              </select>
            </label>
            
            <label>
              <span>Tone</span>
              <select 
                value={playgroundTone} 
                onChange={e => setPlaygroundTone(e.target.value)}
              >
                <option value="none">None (Default)</option>
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
                <option value="success">Success</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="neutral">Neutral</option>
              </select>
            </label>

            <label>
              <span>Size (Density/Radius)</span>
              <input 
                type="range" 
                min="0" 
                max="5" 
                value={playgroundSize} 
                onChange={e => setPlaygroundSize(Number(e.target.value))} 
              />
              <span>{playgroundSize}</span>
            </label>
          </div>

          <div className="surface-playground__preview">
            <div className={`surface-playground__box ${playgroundClass}`}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Interactive Surface</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                Adjust controls to see how parameters affect the surface.
              </div>
            </div>
            <div className="density-code-snippet" style={{ marginTop: '1rem', width: '100%' }}>
              .my-element &#123; {mixinCode} &#125;
            </div>
          </div>
        </div>
      </div>

      <div className="surfaces-doc-container">
        <h4 className="demo-subtitle">Mixin Documentation</h4>
        <div className="surface-doc-card">
          <p className="surface-doc-intro">
            The <code>@ds-surface</code> mixin applies a preset combination of properties to an element.
            It ensures consistency across all containers in your application.
          </p>
          <div className="surface-doc-params">
            <h5 className="surface-doc-subtitle">Configurable Properties:</h5>
            <ul className="surface-doc-list">
              <li><strong>padding</strong>: Internal spacing (usually density tokens)</li>
              <li><strong>radius</strong>: Border radius (radius tokens)</li>
              <li><strong>bg</strong>: Background color (palette tokens)</li>
              <li><strong>color</strong>: Text color (palette tokens)</li>
              <li><strong>border</strong>: Border style (border tokens or raw CSS)</li>
              <li><strong>shadow</strong>: Box shadow (shadow tokens)</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="surfaces-viz-container">
        <h4 className="demo-subtitle">Stacking Context Visualization</h4>
        <div className="surfaces-viz-wrapper">
          <div className="surfaces-stack">
            {(['flat', 'outlined', 'contained'] as const).map((key) => (
              <div 
                key={key}
                className={`surface-card-viz surface-card-viz--${key} demo-surface-${key}`}
                onClick={() => setEditingKey(key)}
                title={`Click to edit ${key}`}
              >
                <span style={{ fontWeight: 'bold' }}>{key}</span>
                <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>surface({key})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="surfaces-grid-container">
        <h4 className="demo-subtitle">Token Reference</h4>
        <div className="surfaces-grid">
          {(Object.keys(surfaces) as SurfaceKey[]).map((key) => (
            <div key={key} className="surface-card">
              <div className="surface-card__header">
                <div className="surface-card__title-group">
                  <div className="surface-card__token">surface({key})</div>
                  <div className="surface-card__desc">{surfaces[key].description}</div>
                </div>
                <button 
                  className="surface-card__edit-btn"
                  onClick={() => setEditingKey(key)}
                >
                  Edit
                </button>
              </div>

              <div className="surface-card__preview">
                <div className={`surface-preview-box demo-surface-${key}`}>
                  Preview Content
                </div>
              </div>

              <div className="surface-props-list">
                {Object.entries(surfaces[key]).map(([prop, val]) => {
                  if (prop === 'description') return null
                  return (
                    <div key={prop} className="surface-prop">
                      <span className="surface-prop-key">{prop}:</span>
                      <span className="surface-prop-val">{val}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {editingKey && (
        <EditSurfaceDialog 
          surfaceKey={editingKey}
          initialProps={surfaces[editingKey]}
          onSave={handleSave}
          onClose={() => setEditingKey(null)}
        />
      )}
    </section>
  )
}
