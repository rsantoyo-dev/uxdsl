'use client'

import { useState, useEffect } from 'react'

export default function InputDemo() {
  const [playgroundVariant, setPlaygroundVariant] = useState<'contained' | 'outlined' | 'underline'>('outlined')
  const [playgroundTone, setPlaygroundTone] = useState<string>('neutral')
  const [playgroundDensity, setPlaygroundDensity] = useState<number>(2)
  const [playgroundRadius, setPlaygroundRadius] = useState<number>(2)
  const [playgroundShadow, setPlaygroundShadow] = useState<number>(0)
  const [playgroundHover, setPlaygroundHover] = useState<boolean>(false)
  const [playgroundFocus, setPlaygroundFocus] = useState<boolean>(false)

  // Auto-update defaults when variant changes
  useEffect(() => {
    if (playgroundVariant === 'contained') {
      setPlaygroundShadow(1)
    } else {
      setPlaygroundShadow(0)
    }
  }, [playgroundVariant])

  // Compute playground class based on mixin logic + utility classes
  const baseClass = `inputs-playground__element--${playgroundVariant}-${playgroundTone}-${playgroundDensity}`
  const playgroundClass = `${baseClass} demo-radius-${playgroundRadius} demo-shadow-${playgroundShadow} ${playgroundHover ? 'force-hover' : ''} ${playgroundFocus ? 'force-focus' : ''}`

  return (
    <section className="inputs-section demo-section">
      <div className="inputs-header">
        <p className="demo-subtitle">
          Inputs are form controls styled with the <code>@ds-input</code> mixin.
          They follow the &quot;Smart Mixin&quot; pattern, providing responsive sizing and consistent state management for focus, hover, and validation states.
        </p>
        <div className="density-code-snippet">
          .input &#123; @ds-input(outlined neutral) &#125;
        </div>
      </div>

      <div className="inputs-playground-container">
        <h4 className="demo-subtitle">Interactive Playground</h4>
        <div className="inputs-playground">
          <div className="inputs-playground__controls">
            <label>
              <span>Variant</span>
              <select 
                value={playgroundVariant} 
                onChange={e => setPlaygroundVariant(e.target.value as 'contained' | 'outlined' | 'underline')}
              >
                <option value="contained">Contained</option>
                <option value="outlined">Outlined</option>
                <option value="underline">Underline</option>
              </select>
            </label>
            
            <label>
              <span>Tone</span>
              <select 
                value={playgroundTone} 
                onChange={e => setPlaygroundTone(e.target.value)}
              >
                <option value="neutral">Neutral (Default)</option>
                <option value="primary">Primary</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
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
                  checked={playgroundFocus} 
                  onChange={e => setPlaygroundFocus(e.target.checked)} 
                />
                <span>Force Focus</span>
              </label>
            </div>
          </div>

          <div className="inputs-playground__preview">
            <input 
              className={`inputs-playground__element ${playgroundClass}`} 
              placeholder="Type here..." 
              readOnly={false}
            />
            
            <div className="density-code-snippet" style={{ marginTop: '1rem', width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: 1.6 }}>
              <div><span style={{ color: '#d4d4d4' }}>.my-input</span> <span style={{ color: '#d4d4d4' }}>&#123;</span></div>
              
              {/* Mixin Call */}
              <div style={{ paddingLeft: '1rem' }}>
                <span style={{ color: '#c586c0' }}>@ds-input</span>
                <span style={{ color: '#d4d4d4' }}>(</span>
                <span style={{ color: '#9cdcfe' }}>{playgroundVariant}</span>
                <span style={{ color: '#9cdcfe' }}> {playgroundTone}</span>
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
      <div className="inputs-resolved-output-container" style={{ marginTop: '2rem' }}>
        <h4 className="demo-subtitle">Resolved CSS Output for .my-input</h4>
        <div className="density-code-snippet" style={{ fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: 1.6 }}>
          <div><span style={{ color: '#d4d4d4' }}>.my-input</span> <span style={{ color: '#d4d4d4' }}>&#123;</span></div>
          
          {/* Background and Border */}
          <div style={{ paddingLeft: '1rem' }}>
            <span style={{ color: '#9cdcfe' }}>border</span>: 
            <span style={{ color: '#ce9178' }}> 1px solid palette</span>(<span style={{ color: '#b5cea8' }}>
              {playgroundVariant === 'underline' ? 'transparent' : `${playgroundTone}-main`}
            </span>);
          </div>
          {playgroundVariant === 'underline' && (
             <div style={{ paddingLeft: '1rem' }}>
               <span style={{ color: '#9cdcfe' }}>border-bottom</span>: 
               <span style={{ color: '#ce9178' }}> 1px solid palette</span>(<span style={{ color: '#b5cea8' }}>{playgroundTone}-main</span>);
             </div>
          )}

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
            <div><span style={{ color: '#d4d4d4' }}>&amp;:focus</span> <span style={{ color: '#d4d4d4' }}>&#123;</span></div>
            <div style={{ paddingLeft: '1rem' }}>
              <span style={{ color: '#9cdcfe' }}>border-color</span>: 
              <span style={{ color: '#ce9178' }}> palette</span>(<span style={{ color: '#b5cea8' }}>
                {playgroundTone === 'neutral' ? 'primary-main' : `${playgroundTone}-main`}
              </span>);
            </div>
            <div style={{ paddingLeft: '1rem' }}>
              <span style={{ color: '#9cdcfe' }}>box-shadow</span>: 
              <span style={{ color: '#ce9178' }}> ring</span>(<span style={{ color: '#b5cea8' }}>2</span>);
            </div>
            <div><span style={{ color: '#d4d4d4' }}>&#125;</span></div>
          </div>
          
          <div><span style={{ color: '#d4d4d4' }}>&#125;</span></div>
        </div>
      </div>

      <div className="inputs-doc-container">
        <h4 className="demo-subtitle">Mixin Documentation</h4>
        <div className="inputs-doc-card">
          <p className="inputs-doc-intro">
            The <code>@ds-input</code> mixin is the primary primitive for form controls. 
            It accepts a <strong>Variant</strong> (structure) and <strong>Tone</strong> (validation state), followed by optional granular tokens 
            for <strong>Density</strong> (padding), <strong>Radius</strong>, and <strong>Shadow</strong>. 
            It automatically handles <strong>Focus</strong> rings and validation styling.
          </p>
          <div className="inputs-doc-params">
            <h5 className="inputs-doc-subtitle">Smart Parameters:</h5>
            <ul className="inputs-doc-list">
              <li><strong>variant</strong>: contained, outlined, underline.</li>
              <li><strong>tone</strong>: neutral (default), primary, success, error. Applies border colors.</li>
              <li><strong>density(N)</strong>: Responsive padding (0-5).</li>
              <li><strong>radius(N)</strong>: Border radius (0-5).</li>
              <li><strong>shadow(N)</strong>: Box shadow depth (0-5).</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="inputs-grid-container">
        <h4 className="demo-subtitle">Examples</h4>
        <div className="inputs-grid">
          <div className="input-card">
            <input className="inputs-playground__element input-ex-contained-primary" placeholder="Contained" />
            <span className="input-card__label">@ds-input(contained primary)</span>
          </div>
          <div className="input-card">
            <input className="inputs-playground__element input-ex-outlined-primary" placeholder="Outlined" />
            <span className="input-card__label">@ds-input(outlined primary)</span>
          </div>
          <div className="input-card">
            <input className="inputs-playground__element input-ex-underline-primary" placeholder="Underline" />
            <span className="input-card__label">@ds-input(underline primary)</span>
          </div>
          <div className="input-card">
            <input className="inputs-playground__element input-ex-outlined-error" placeholder="Error State" />
            <span className="input-card__label">@ds-input(outlined error)</span>
          </div>
          <div className="input-card">
            <input className="inputs-playground__element input-ex-outlined-success" placeholder="Success State" />
            <span className="input-card__label">@ds-input(outlined success)</span>
          </div>
        </div>
      </div>
    </section>
  )
}