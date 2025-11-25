'use client'

import { useState } from 'react'

export default function DemoProductivity() {
  const [activeTab, setActiveTab] = useState<'demo' | 'uxdsl' | 'tailwind' | 'scss'>('demo')

  return (
    <div className="prod-container" style={{ display: 'block' }}>
      <div className="prod-tabs">
        <button 
          className={`prod-tab-btn ${activeTab === 'demo' ? 'active' : ''}`}
          onClick={() => setActiveTab('demo')}
        >
          Live Demo
        </button>
        <button 
          className={`prod-tab-btn ${activeTab === 'uxdsl' ? 'active' : ''}`}
          onClick={() => setActiveTab('uxdsl')}
        >
          UXDSL
        </button>
        <button 
          className={`prod-tab-btn ${activeTab === 'tailwind' ? 'active' : ''}`}
          onClick={() => setActiveTab('tailwind')}
        >
          Tailwind
        </button>
        <button 
          className={`prod-tab-btn ${activeTab === 'scss' ? 'active' : ''}`}
          onClick={() => setActiveTab('scss')}
        >
          SCSS
        </button>
      </div>

      {/* Tab Content */}
      <div className="prod-tab-content">
      {activeTab === 'demo' && (
        <div style={{ maxWidth: '400px', margin: '0 auto' }}>
          <div className="prod-card">
            <div className="prod-header">
              <div className="prod-avatar">JD</div>
              <div>
                <h4 className="prod-title">Jane Doe</h4>
                <p className="prod-subtitle">Senior Engineer</p>
              </div>
            </div>
            <div className="prod-content">
              <p className="prod-text">
                Passionate about design systems and productivity. 
                Building the future of UI development.
              </p>
            </div>
            <div className="prod-actions">
              <button className="prod-btn-primary">Connect</button>
              <button className="prod-btn-secondary">Message</button>
            </div>
          </div>
          <p style={{ textAlign: 'center', marginTop: '1rem', opacity: 0.7, fontSize: '0.9rem' }}>
            Resize the window to see the card adapt (padding, gaps, font-size) automatically.
          </p>

          {/* New Responsive Form Demo */}
          <div className="prod-form">
            <h4 className="prod-form-title">Responsive Form</h4>
            <div className="prod-form-row">
              <div className="prod-input-group">
                <label className="prod-label">First Name</label>
                <input className="prod-input" placeholder="John" />
              </div>
              <div className="prod-input-group">
                <label className="prod-label">Last Name</label>
                <input className="prod-input" placeholder="Doe" />
              </div>
            </div>
            <div className="prod-input-group">
              <label className="prod-label">Email</label>
              <input className="prod-input" placeholder="john@example.com" />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'uxdsl' && (
        <div className="prod-code-section">
          <div className="prod-code-block">
            <span className="prod-code-title">Component (JSX)</span>
            <pre>{`export function UserCard() {
  return (
    <div className="prod-card">
      ...
    </div>
  )
}

export function ResponsiveForm() {
  return (
    <div className="prod-form">
      <div className="prod-form-row">
        <input className="prod-input" />
        <input className="prod-input" />
      </div>
    </div>
  )
}`}</pre>
          </div>
          
          <div className="prod-code-block">
            <span className="prod-code-title">Styles (.uxdsl)</span>
            <div className="prod-comment">
              {`/* 
  @ds-card & @ds-input: Encapsulate 30+ lines of styles (theming, states, dark mode).
  density(): Consistent spacing system.
  xs() md(): Concise responsive syntax.
  @ds-font: Typography system integration.
*/`}
            </div>
            <pre>{`.prod-card {
  @ds-card;
  display: flex;
  flex-direction: column;
  gap: density(2);
}

.prod-form {
  @ds-surface(subtle);
  display: flex;
  flex-direction: column;
  gap: density(2);
}

.prod-row {
  display: flex;
  flex-direction: xs(column) md(row);
  gap: density(2);
}

.prod-input {
  @ds-input(outlined);
  @ds-font(body-1);
  width: 100%;
}`}</pre>
          </div>
        </div>
      )}

      {activeTab === 'tailwind' && (
        <div className="prod-code-block">
          <span className="prod-code-title">Tailwind Implementation (HTML)</span>
          <div className="prod-comment">
            {`<!-- 
  "Pro" Tailwind:
  Functionally identical to the UXDSL example.
  Requires 40+ utility classes to match 4 UXDSL mixins.
  Harder to read "at a glance".
-->`}
          </div>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
{`<!-- .prod-card equivalent -->
<div class="
  flex flex-col gap-4 
  p-6 
  bg-white dark:bg-slate-900 
  border border-gray-200 dark:border-gray-700 
  rounded-lg shadow-sm
">
  <!-- Content... -->
</div>

<!-- .prod-form equivalent -->
<div class="
  flex flex-col gap-4 
  p-6 
  bg-gray-50 dark:bg-slate-800 
  border border-gray-200 dark:border-gray-700 
  rounded-lg
">
  
  <!-- .prod-row equivalent -->
  <div class="flex flex-col md:flex-row gap-4">
    
    <!-- .prod-input equivalent (x2) -->
    <input class="
      w-full 
      px-3 py-2 
      text-base 
      bg-white dark:bg-slate-900 
      text-gray-900 dark:text-white 
      border border-gray-300 dark:border-gray-600 
      rounded-md 
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
      transition-colors
    " />
    
    <input class="
      w-full 
      px-3 py-2 
      text-base 
      bg-white dark:bg-slate-900 
      text-gray-900 dark:text-white 
      border border-gray-300 dark:border-gray-600 
      rounded-md 
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
      transition-colors
    " />
    
  </div>
</div>`}
          </pre>
        </div>
      )}

      {activeTab === 'scss' && (
        <div className="prod-code-block">
          <span className="prod-code-title">SCSS / BEM Implementation</span>
          <div className="prod-comment">
            {`/* 
  Standard SCSS approach.
  Requires manual media queries and variable management.
*/`}
          </div>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
{`.prod-card {
  display: flex;
  flex-direction: column;
  
  // Manual responsive spacing
  padding: $spacing-4;
  gap: $spacing-3;
  
  @media (min-width: 768px) {
    padding: $spacing-6;
    gap: $spacing-4;
  }
  
  @media (min-width: 1280px) {
    padding: $spacing-8;
    gap: $spacing-5;
  }

  // Theming
  background: $color-surface-main;
  border: 1px solid $color-neutral-light;
  border-radius: $radius-lg;
  box-shadow: $shadow-sm;
  
  // Dark mode handling
  @media (prefers-color-scheme: dark) {
    background: $color-surface-dark-main;
    border-color: $color-neutral-dark-light;
  }
}

.prod-form {
  display: flex;
  flex-direction: column;
  margin-top: $spacing-6;
  padding: $spacing-6;
  border: 1px solid $color-neutral-light;
  border-radius: $radius-lg;
  background: $color-surface-light;
  
  // Manual responsive gap
  gap: $spacing-2;
  @media (min-width: 768px) {
    gap: $spacing-4;
  }
}

.prod-form-row {
  display: flex;
  // Manual responsive direction
  flex-direction: column;
  gap: $spacing-4;
  
  @media (min-width: 768px) {
    flex-direction: row;
  }
}

.prod-input {
  width: 100%;
  border: 1px solid $color-neutral;
  border-radius: $radius-md;
  padding: $spacing-2 $spacing-3;
  background: transparent;
  
  // Manual responsive font size
  font-size: 0.875rem;
  @media (min-width: 768px) {
    font-size: 1rem;
  }
  
  &:focus {
    outline: none;
    border-color: $color-primary;
    box-shadow: 0 0 0 2px $color-primary-light;
  }
}`}
          </pre>
        </div>
      )}
      </div>
    </div>
  )
}