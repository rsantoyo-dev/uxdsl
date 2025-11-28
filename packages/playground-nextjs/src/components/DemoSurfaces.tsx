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
    .replace(/radius\(([^)]+)\)/g, 'var(--space-$1)')
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
  const [playgroundDensity, setPlaygroundDensity] = useState<number>(2)
  const [playgroundRadius, setPlaygroundRadius] = useState<number>(2)
  const [playgroundShadow, setPlaygroundShadow] = useState<number>(1)

  // Auto-update defaults when variant changes
  useEffect(() => {
    if (playgroundVariant === 'contained') {
      setPlaygroundShadow(1)
    } else {
      setPlaygroundShadow(0)
    }
  }, [playgroundVariant])

  // Compute playground class based on mixin logic + utility classes
  const baseClass = `surface-playground__box--${playgroundVariant}-${playgroundTone}-${playgroundDensity}`
  const playgroundClass = `${baseClass} demo-radius-${playgroundRadius} demo-shadow-${playgroundShadow}`

  return (
    <section className="surfaces-section demo-section">
      <div className="surfaces-header">
        <p className="demo-subtitle">
          Surfaces are intelligent, composite containers that manage background, border, shadow, and spacing.
          They use a flexible &quot;Smart Mixin&quot; syntax to apply responsive defaults while allowing granular control over density, radius, and depth.
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
              <span>Density (Padding)</span>
              <input 
                type="range" 
                min="0" 
                max="5" 
                value={playgroundDensity} 
                onChange={e => setPlaygroundDensity(Number(e.target.value))} 
              />
              <span>{playgroundDensity}</span>
            </label>

            <label>
              <span>Radius</span>
              <input 
                type="range" 
                min="0" 
                max="5" 
                value={playgroundRadius} 
                onChange={e => setPlaygroundRadius(Number(e.target.value))} 
              />
              <span>{playgroundRadius}</span>
            </label>

            <label>
              <span>Shadow</span>
              <input 
                type="range" 
                min="0" 
                max="5" 
                value={playgroundShadow} 
                onChange={e => setPlaygroundShadow(Number(e.target.value))} 
              />
              <span>{playgroundShadow}</span>
            </label>
          </div>

          <div className="surface-playground__preview">
            <div className={`surface-playground__box ${playgroundClass}`}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Interactive Surface</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                Adjust controls to see how parameters affect the surface.
              </div>
            </div>
            <div className="density-code-snippet" style={{ marginTop: '1rem', width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: 1.6 }}>
              <div><span style={{ color: '#d4d4d4' }}>.my-element</span> <span style={{ color: '#d4d4d4' }}>&#123;</span></div>
              
              {/* Mixin Call */}
              <div style={{ paddingLeft: '1rem' }}>
                <span style={{ color: '#c586c0' }}>@ds-surface</span>
                <span style={{ color: '#d4d4d4' }}>(</span>
                <span style={{ color: '#9cdcfe' }}>{playgroundVariant}</span>
                {playgroundTone !== 'none' && <span style={{ color: '#9cdcfe' }}> {playgroundTone}</span>}
                <span style={{ color: '#b5cea8' }}> density</span>(<span style={{ color: '#ce9178' }}>{playgroundDensity}</span>)
                <span style={{ color: '#b5cea8' }}> radius</span>(<span style={{ color: '#ce9178' }}>{playgroundRadius}</span>)
                {playgroundShadow !== 0 && (
                  <span><span style={{ color: '#b5cea8' }}> shadow</span>(<span style={{ color: '#ce9178' }}>{playgroundShadow}</span>)</span>
                )}
                <span style={{ color: '#d4d4d4' }}>);</span>
              </div>
              
              <div><span style={{ color: '#d4d4d4' }}>&#125;</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* New Resolved Values Code Card */}
      <div className="surfaces-resolved-output-container" style={{ marginTop: '2rem' }}>
        <h4 className="demo-subtitle">Resolved CSS Output for .my-element</h4>
        <div className="density-code-snippet" style={{ fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: 1.6 }}>
          <div><span style={{ color: '#d4d4d4' }}>.my-element</span> <span style={{ color: '#d4d4d4' }}>&#123;</span></div>
          
          {/* Background and Color */}
          <div style={{ paddingLeft: '1rem' }}>
            <span style={{ color: '#9cdcfe' }}>background-color</span>: 
            <span style={{ color: '#ce9178' }}> palette</span>(<span style={{ color: '#b5cea8' }}>
              {playgroundVariant === 'contained' 
                ? (playgroundTone === 'none' ? 'surface-main' : `${playgroundTone}-main`)
                : 'transparent'
              }
            </span>);
          </div>
          <div style={{ paddingLeft: '1rem' }}>
            <span style={{ color: '#9cdcfe' }}>color</span>: 
            <span style={{ color: '#ce9178' }}> palette</span>(<span style={{ color: '#b5cea8' }}>
              {playgroundVariant === 'contained'
                ? (playgroundTone === 'none' ? 'surface-contrast' : `${playgroundTone}-contrast`)
                : (playgroundTone === 'none' ? 'surface-contrast' : `${playgroundTone}-main`)
              }
            </span>);
          </div>

          {/* Padding */}
          <div style={{ paddingLeft: '1rem' }}>
            <span style={{ color: '#9cdcfe' }}>padding</span>: 
            <span style={{ color: '#ce9178' }}> density</span>(<span style={{ color: '#b5cea8' }}>{playgroundDensity}</span>);
          </div>

          {/* Radius */}
          <div style={{ paddingLeft: '1rem' }}>
            <span style={{ color: '#9cdcfe' }}>border-radius</span>: 
            <span style={{ color: '#ce9178' }}> radius</span>(<span style={{ color: '#b5cea8' }}>{playgroundRadius}</span>);
          </div>

          {/* Shadow */}
          {(playgroundShadow > 0 || playgroundVariant === 'contained') && (
            <div style={{ paddingLeft: '1rem' }}>
              <span style={{ color: '#9cdcfe' }}>box-shadow</span>: 
              {playgroundShadow === 0 ? (
                 <span style={{ color: '#569cd6' }}>none;</span>
              ) : (
                 <span><span style={{ color: '#ce9178' }}> shadow</span>(<span style={{ color: '#b5cea8' }}>{playgroundShadow}</span>);</span>
              )}
            </div>
          )}
          
          <div><span style={{ color: '#d4d4d4' }}>&#125;</span></div>
        </div>
      </div>

      <div className="surfaces-doc-container">
        <h4 className="demo-subtitle">Mixin Documentation</h4>
        <div className="surface-doc-card">
          <p className="surface-doc-intro">
            The <code>@ds-surface</code> mixin is the primary primitive for building containers. 
            It accepts a <strong>Variant</strong> (structure) and <strong>Tone</strong> (color), followed by optional granular tokens 
            for <strong>Density</strong> (padding), <strong>Radius</strong>, and <strong>Shadow</strong>.
          </p>
          <div className="surface-doc-params">
            <h5 className="surface-doc-subtitle">Smart Parameters:</h5>
            <ul className="surface-doc-list">
              <li><strong>variant</strong>: Base style (contained, outlined, flat). Determines default borders/shadows.</li>
              <li><strong>tone</strong>: Applies semantic color palette (bg/text/border) automatically.</li>
              <li><strong>density(N)</strong>: Sets responsive padding. Scales automatically across breakpoints.</li>
              <li><strong>radius(N)</strong>: Sets border-radius. Defaults to system standard (usually 2).</li>
              <li><strong>shadow(N)</strong>: Sets box-shadow depth. Defaults based on variant (1 for contained, 0 for others).</li>
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
