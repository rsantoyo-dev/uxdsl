'use client'

import { useState, useEffect } from 'react'

export default function DemoButtons() {
  const [playgroundVariant, setPlaygroundVariant] = useState<'contained' | 'outlined' | 'flat'>('contained')
  const [playgroundTone, setPlaygroundTone] = useState<string>('primary')
  const [playgroundDensity, setPlaygroundDensity] = useState<number>(2)
  const [playgroundRadius, setPlaygroundRadius] = useState<number>(2)
  const [playgroundShadow, setPlaygroundShadow] = useState<number>(1)
  const [playgroundHover, setPlaygroundHover] = useState<boolean>(false)
  const [playgroundActive, setPlaygroundActive] = useState<boolean>(false)
  const [playgroundSelected, setPlaygroundSelected] = useState<boolean>(false)

  // Auto-update defaults when variant changes
  useEffect(() => {
    if (playgroundVariant === 'contained') {
      setPlaygroundShadow(1)
    } else {
      setPlaygroundShadow(0)
    }
  }, [playgroundVariant])

  // Compute playground class based on mixin logic + utility classes
  const baseClass = `buttons-playground__element--${playgroundVariant}-${playgroundTone}-${playgroundDensity}`
  const playgroundClass = `${baseClass} demo-radius-${playgroundRadius} demo-shadow-${playgroundShadow} ${playgroundHover ? 'force-hover' : ''} ${playgroundActive ? 'force-active' : ''} ${playgroundSelected ? 'force-selected' : ''}`

  return (
    <section className="buttons-section demo-section">
      <div className="buttons-header">
        <h3 className="demo-title">Buttons</h3>
        <p className="demo-subtitle">
          Buttons are intelligent, interactive elements styled with the <code>@ds-button</code> mixin.
          They use the same "Smart Mixin" syntax as surfaces, allowing responsive control over density, radius, and depth, with built-in state management.
        </p>
        <div className="density-code-snippet">
          .btn &#123; @ds-button(contained primary) &#125;
        </div>
      </div>

      <div className="surfaces-playground-container">
        <h4 className="demo-subtitle">Interactive Playground</h4>
        <div className="buttons-playground">
          <div className="buttons-playground__controls">
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  checked={playgroundHover} 
                  onChange={e => setPlaygroundHover(e.target.checked)} 
                />
                <span>Force Hover</span>
              </label>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  checked={playgroundActive} 
                  onChange={e => setPlaygroundActive(e.target.checked)} 
                />
                <span>Force Active</span>
              </label>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  checked={playgroundSelected} 
                  onChange={e => setPlaygroundSelected(e.target.checked)} 
                />
                <span>Force Selected</span>
              </label>
            </div>
          </div>

          <div className="buttons-playground__preview">
            <button className={`buttons-playground__element ${playgroundClass}`}>
              Interactive Button
            </button>
            
            <div className="density-code-snippet" style={{ marginTop: '1rem', width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: 1.6 }}>
              <div><span style={{ color: '#d4d4d4' }}>.my-button</span> <span style={{ color: '#d4d4d4' }}>&#123;</span></div>
              
              {/* Mixin Call */}
              <div style={{ paddingLeft: '1rem' }}>
                <span style={{ color: '#c586c0' }}>@ds-button</span>
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

      {/* Resolved Values Code Card */}
      <div className="buttons-resolved-output-container" style={{ marginTop: '2rem' }}>
        <h4 className="demo-subtitle">Resolved CSS Output for .my-button</h4>
        <div className="density-code-snippet" style={{ fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: 1.6 }}>
          <div><span style={{ color: '#d4d4d4' }}>.my-button</span> <span style={{ color: '#d4d4d4' }}>&#123;</span></div>
          
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

          {/* State Styles */}
          <div style={{ marginTop: '0.5rem' }}>
            <div><span style={{ color: '#d4d4d4' }}>&amp;:hover</span> <span style={{ color: '#d4d4d4' }}>&#123;</span></div>
            <div style={{ paddingLeft: '1rem' }}>
              <span style={{ color: '#9cdcfe' }}>background-color</span>: 
              <span style={{ color: '#ce9178' }}> palette</span>(<span style={{ color: '#b5cea8' }}>
                {playgroundTone !== 'none' ? `${playgroundTone}-light` : 'surface-dark'}
              </span>);
            </div>
            <div><span style={{ color: '#d4d4d4' }}>&#125;</span></div>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <div><span style={{ color: '#d4d4d4' }}>&amp;:active</span> <span style={{ color: '#d4d4d4' }}>&#123;</span></div>
            <div style={{ paddingLeft: '1rem' }}>
              <span style={{ color: '#9cdcfe' }}>transform</span>: 
              <span style={{ color: '#b5cea8' }}> scale</span>(<span style={{ color: '#ce9178' }}>0.98</span>);
            </div>
            <div><span style={{ color: '#d4d4d4' }}>&#125;</span></div>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <div><span style={{ color: '#d4d4d4' }}>&amp;.selected</span> <span style={{ color: '#d4d4d4' }}>&#123;</span></div>
            <div style={{ paddingLeft: '1rem' }}>
              <span style={{ color: '#9cdcfe' }}>box-shadow</span>: 
              <span style={{ color: '#ce9178' }}> inset 0 0 0 2px currentColor;</span>
            </div>
            <div style={{ paddingLeft: '1rem' }}>
              <span style={{ color: '#9cdcfe' }}>font-weight</span>: 
              <span style={{ color: '#ce9178' }}> bold;</span>
            </div>
            <div><span style={{ color: '#d4d4d4' }}>&#125;</span></div>
          </div>
          
          <div><span style={{ color: '#d4d4d4' }}>&#125;</span></div>
        </div>
      </div>

      <div className="buttons-doc-container">
        <h4 className="demo-subtitle">Mixin Documentation</h4>
        <div className="buttons-doc-card">
          <p className="buttons-doc-intro">
            The <code>@ds-button</code> mixin is the primary primitive for interactive elements. 
            It accepts a <strong>Variant</strong> (structure) and <strong>Tone</strong> (color), followed by optional granular tokens 
            for <strong>Density</strong> (padding), <strong>Radius</strong>, and <strong>Shadow</strong>. 
            It automatically generates <strong>Hover</strong>, <strong>Active</strong>, and <strong>Selected</strong> states.
          </p>
          <div className="buttons-doc-params">
            <h5 className="buttons-doc-subtitle">Smart Parameters:</h5>
            <ul className="buttons-doc-list">
              <li><strong>variant</strong>: Base style (contained, outlined, flat). Determines default borders/shadows.</li>
              <li><strong>tone</strong>: Applies semantic color palette. Handles contrast automatically.</li>
              <li><strong>density(N)</strong>: Responsive padding (0-5). Scales automatically.</li>
              <li><strong>radius(N)</strong>: Border radius (0-5). Defaults to system standard (2).</li>
              <li><strong>shadow(N)</strong>: Box shadow depth (0-5). Defaults to 1 for contained, 0 for others.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="buttons-grid-container">
        <h4 className="demo-subtitle">Examples</h4>
        <div className="buttons-grid">
          <div className="button-card">
            <button className="btn-example-primary-contained">Primary Contained</button>
            <span className="button-card__label">@ds-button(contained primary)</span>
          </div>
          <div className="button-card">
            <button className="btn-example-primary-outlined">Primary Outlined</button>
            <span className="button-card__label">@ds-button(outlined primary)</span>
          </div>
          <div className="button-card">
            <button className="btn-example-primary-flat">Primary Flat</button>
            <span className="button-card__label">@ds-button(flat primary)</span>
          </div>
          <div className="button-card">
            <button className="btn-example-secondary-contained">Secondary Contained</button>
            <span className="button-card__label">@ds-button(contained secondary)</span>
          </div>
          <div className="button-card">
            <button className="btn-example-secondary-outlined">Secondary Outlined</button>
            <span className="button-card__label">@ds-button(outlined secondary)</span>
          </div>
          <div className="button-card">
            <button className="btn-example-success-contained">Success</button>
            <span className="button-card__label">@ds-button(contained success)</span>
          </div>
          <div className="button-card">
            <button className="btn-example-error-contained">Error</button>
            <span className="button-card__label">@ds-button(contained error)</span>
          </div>
        </div>
      </div>
    </section>
  )
}
