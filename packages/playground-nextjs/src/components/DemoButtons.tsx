'use client'

import { useState } from 'react'

export default function DemoButtons() {
  const [playgroundVariant, setPlaygroundVariant] = useState<'contained' | 'outlined' | 'flat'>('contained')
  const [playgroundTone, setPlaygroundTone] = useState<string>('primary')
  const [playgroundSize, setPlaygroundSize] = useState<number>(2)

  // Compute playground class based on mixin logic
  const playgroundClass = `buttons-playground__element--${playgroundVariant}-${playgroundTone}-${playgroundSize}`
  const mixinCode = `@ds-button(${playgroundVariant} ${playgroundTone !== 'none' ? playgroundTone : ''} ${playgroundSize})`

  return (
    <section className="buttons-section demo-section">
      <div className="buttons-header">
        <h3 className="demo-title">Buttons</h3>
        <p className="demo-subtitle">
          Buttons are interactive elements that trigger actions. The <code>@ds-button</code> mixin provides a consistent way to style them using your design tokens.
        </p>
        <div className="density-code-snippet">
          .btn &#123; @ds-button(contained primary) &#125;
        </div>
      </div>

      <div className="buttons-playground-container">
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

          <div className="buttons-playground__preview">
            <button className={`buttons-playground__element ${playgroundClass}`}>
              Interactive Button
            </button>
            <div className="density-code-snippet" style={{ marginTop: '2rem', width: '100%' }}>
              .my-button &#123; {mixinCode} &#125;
            </div>
          </div>
        </div>
      </div>

      <div className="buttons-doc-container">
        <h4 className="demo-subtitle">Mixin Documentation</h4>
        <div className="buttons-doc-card">
          <p className="buttons-doc-intro">
            The <code>@ds-button</code> mixin applies styles for background, color, border, padding, and radius based on the selected variant and tone. It also handles hover and active states automatically.
          </p>
          <div className="buttons-doc-params">
            <h5 className="buttons-doc-subtitle">Parameters:</h5>
            <ul className="buttons-doc-list">
              <li><strong>variant</strong>: contained, outlined, flat</li>
              <li><strong>tone</strong>: primary, secondary, success, error, etc. (optional)</li>
              <li><strong>size</strong>: 0-5 (optional, defaults to 2)</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="buttons-grid-container">
        <h4 className="demo-subtitle">Examples</h4>
        <div className="buttons-grid">
          <div className="button-card">
            <button className="btn-example-primary-contained">Primary Contained</button>
            <span className="button-card__label">contained primary</span>
          </div>
          <div className="button-card">
            <button className="btn-example-primary-outlined">Primary Outlined</button>
            <span className="button-card__label">outlined primary</span>
          </div>
          <div className="button-card">
            <button className="btn-example-primary-flat">Primary Flat</button>
            <span className="button-card__label">flat primary</span>
          </div>
          <div className="button-card">
            <button className="btn-example-secondary-contained">Secondary Contained</button>
            <span className="button-card__label">contained secondary</span>
          </div>
          <div className="button-card">
            <button className="btn-example-secondary-outlined">Secondary Outlined</button>
            <span className="button-card__label">outlined secondary</span>
          </div>
          <div className="button-card">
            <button className="btn-example-success-contained">Success</button>
            <span className="button-card__label">contained success</span>
          </div>
          <div className="button-card">
            <button className="btn-example-error-contained">Error</button>
            <span className="button-card__label">contained error</span>
          </div>
        </div>
      </div>
    </section>
  )
}
