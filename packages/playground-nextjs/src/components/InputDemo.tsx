'use client'

import { useState, useEffect } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

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
        <div className="demo-code-block">
          <SyntaxHighlighter
            language="scss"
            style={vscDarkPlus}
            customStyle={{ margin: 0, borderRadius: '4px' }}
          >
            {`.input { @ds-input(outlined neutral) }`}
          </SyntaxHighlighter>
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
            
            <div className="demo-code-block" style={{ marginTop: '1rem', width: '100%' }}>
              <SyntaxHighlighter
                language="scss"
                style={vscDarkPlus}
                customStyle={{ margin: 0, borderRadius: '4px' }}
              >
{`.my-input {
  @ds-input(${playgroundVariant} ${playgroundTone} density(${playgroundDensity}) radius(${playgroundRadius})${playgroundShadow !== 0 ? ' shadow(' + playgroundShadow + ')' : ''});
}`}
              </SyntaxHighlighter>
            </div>
          </div>
        </div>
      </div>

      {/* Resolved Values Code Card */}
      <div className="inputs-resolved-output-container" style={{ marginTop: '2rem' }}>
        <h4 className="demo-subtitle">Resolved CSS Output for .my-input</h4>
        <div className="demo-code-block">
          <SyntaxHighlighter
            language="css"
            style={vscDarkPlus}
            customStyle={{ margin: 0, borderRadius: '4px' }}
          >
{`.my-input {
  border: 1px solid palette(${playgroundVariant === 'underline' ? 'transparent' : `${playgroundTone}-main`});
  ${playgroundVariant === 'underline' ? `border-bottom: 1px solid palette(${playgroundTone}-main);` : ''}
  padding: density(${playgroundDensity});
  border-radius: radius(${playgroundRadius});
  ${playgroundShadow !== 0 || playgroundVariant === 'contained' 
    ? `box-shadow: ${playgroundShadow === 0 ? 'none' : `shadow(${playgroundShadow})`};` 
    : ''}

  &:focus {
    border-color: palette(${playgroundTone === 'neutral' ? 'primary-main' : `${playgroundTone}-main`});
    box-shadow: ring(2);
  }
}`}
          </SyntaxHighlighter>
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