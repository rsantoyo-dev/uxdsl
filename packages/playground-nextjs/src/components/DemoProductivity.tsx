'use client'

import React, { useState } from 'react'

export default function DemoProductivity() {
  const [activeTab, setActiveTab] = useState<'uxdsl' | 'scss'>('uxdsl')

  return (
    <section className="demo-section">
      <div className="demo-header">
        <h2>Developer Productivity</h2>
        <p>
          Write less, achieve more. UXDSL condenses complex styling patterns into semantic, readable macros.
          The example below demonstrates a complete &quot;Hero Profile Card&quot; with responsive spacing, theming, and typography.
        </p>
      </div>

      <div className="prod-tabs" style={{ justifyContent: 'center' }}>
        <button 
          className={`prod-tab-btn ${activeTab === 'uxdsl' ? 'active' : ''}`}
          onClick={() => setActiveTab('uxdsl')}
        >
          UXDSL
        </button>
        <button 
          className={`prod-tab-btn ${activeTab === 'scss' ? 'active' : ''}`}
          onClick={() => setActiveTab('scss')}
        >
          SCSS
        </button>
      </div>

      <div className="prod-comparison-grid">
        {/* Live Preview (Always Visible) */}
        <div className="demo-preview">
          <div className="prod-card">
            <div className="prod-header">
              <div className="prod-avatar">JD</div>
              <div className="prod-info">
                <h3 className="prod-title">Jane Doe</h3>
                <p className="prod-subtitle">Senior UX Engineer</p>
              </div>
            </div>

            <div className="prod-stats">
              <div className="prod-stat">
                <span className="prod-stat-val">128</span>
                <span className="prod-stat-label">Projects</span>
              </div>
              <div className="prod-stat">
                <span className="prod-stat-val">4.9</span>
                <span className="prod-stat-label">Rating</span>
              </div>
              <div className="prod-stat">
                <span className="prod-stat-val">12k</span>
                <span className="prod-stat-label">Views</span>
              </div>
            </div>

            <div className="prod-actions">
              <button className="prod-btn-primary">Follow</button>
              <button className="prod-btn-secondary">Message</button>
            </div>
          </div>
        </div>

        {/* Code Snippet (Tabbed) */}
        <div className="demo-code">
          {activeTab === 'uxdsl' && (
            <>
              <div className="code-header">
                <span className="code-lang">HeroCard.uxdsl</span>
              </div>
              <pre>
                <code><span style={{ color: '#9cdcfe' }}>.prod-card</span> <span style={{ color: '#d4d4d4' }}>&#123;</span>
  <span style={{ color: '#c586c0' }}>@ds-surface</span>(<span style={{ color: '#9cdcfe' }}>contained</span>);
  
  <span style={{ color: '#6a9955' }}>/* Responsive Layout */</span>
  <span style={{ color: '#9cdcfe' }}>display</span>: <span style={{ color: '#569cd6' }}>flex</span>;
  <span style={{ color: '#9cdcfe' }}>flex-direction</span>: <span style={{ color: '#569cd6' }}>column</span>;
  <span style={{ color: '#9cdcfe' }}>width</span>: <span style={{ color: '#ce9178' }}>xs</span>(<span style={{ color: '#b5cea8' }}>100%</span>) <span style={{ color: '#ce9178' }}>md</span>(<span style={{ color: '#b5cea8' }}>480px</span>);
  <span style={{ color: '#9cdcfe' }}>padding</span>: <span style={{ color: '#ce9178' }}>xs</span>(<span style={{ color: '#ce9178' }}>density</span>(<span style={{ color: '#b5cea8' }}>3</span>)) <span style={{ color: '#ce9178' }}>md</span>(<span style={{ color: '#ce9178' }}>density</span>(<span style={{ color: '#b5cea8' }}>5</span>));
  <span style={{ color: '#9cdcfe' }}>gap</span>: <span style={{ color: '#ce9178' }}>density</span>(<span style={{ color: '#b5cea8' }}>4</span>);
  <span style={{ color: '#9cdcfe' }}>margin</span>: <span style={{ color: '#b5cea8' }}>0 auto</span>;
<span style={{ color: '#d4d4d4' }}>&#125;</span>

<span style={{ color: '#9cdcfe' }}>.prod-header</span> <span style={{ color: '#d4d4d4' }}>&#123;</span>
  <span style={{ color: '#9cdcfe' }}>display</span>: <span style={{ color: '#569cd6' }}>flex</span>;
  <span style={{ color: '#9cdcfe' }}>flex-direction</span>: <span style={{ color: '#ce9178' }}>xs</span>(<span style={{ color: '#569cd6' }}>column</span>) <span style={{ color: '#ce9178' }}>sm</span>(<span style={{ color: '#569cd6' }}>row</span>);
  <span style={{ color: '#9cdcfe' }}>align-items</span>: <span style={{ color: '#569cd6' }}>center</span>;
  <span style={{ color: '#9cdcfe' }}>text-align</span>: <span style={{ color: '#ce9178' }}>xs</span>(<span style={{ color: '#569cd6' }}>center</span>) <span style={{ color: '#ce9178' }}>sm</span>(<span style={{ color: '#569cd6' }}>left</span>);
  <span style={{ color: '#9cdcfe' }}>gap</span>: <span style={{ color: '#ce9178' }}>density</span>(<span style={{ color: '#b5cea8' }}>3</span>);
<span style={{ color: '#d4d4d4' }}>&#125;</span>

<span style={{ color: '#9cdcfe' }}>.prod-avatar</span> <span style={{ color: '#d4d4d4' }}>&#123;</span>
  <span style={{ color: '#9cdcfe' }}>width</span>: <span style={{ color: '#b5cea8' }}>80px</span>;
  <span style={{ color: '#9cdcfe' }}>height</span>: <span style={{ color: '#b5cea8' }}>80px</span>;
  <span style={{ color: '#9cdcfe' }}>border-radius</span>: <span style={{ color: '#ce9178' }}>radius</span>(<span style={{ color: '#9cdcfe' }}>full</span>);
  <span style={{ color: '#9cdcfe' }}>background</span>: <span style={{ color: '#ce9178' }}>palette</span>(<span style={{ color: '#9cdcfe' }}>primary-main</span>);
  <span style={{ color: '#9cdcfe' }}>color</span>: <span style={{ color: '#ce9178' }}>palette</span>(<span style={{ color: '#9cdcfe' }}>primary-contrast</span>);
  <span style={{ color: '#6a9955' }}>/* ...flex centering... */</span>
<span style={{ color: '#d4d4d4' }}>&#125;</span>

<span style={{ color: '#9cdcfe' }}>.prod-stats</span> <span style={{ color: '#d4d4d4' }}>&#123;</span>
  <span style={{ color: '#9cdcfe' }}>display</span>: <span style={{ color: '#569cd6' }}>flex</span>;
  <span style={{ color: '#9cdcfe' }}>justify-content</span>: <span style={{ color: '#569cd6' }}>space-around</span>;
  <span style={{ color: '#9cdcfe' }}>padding</span>: <span style={{ color: '#ce9178' }}>density</span>(<span style={{ color: '#b5cea8' }}>3</span>) <span style={{ color: '#b5cea8' }}>0</span>;
  <span style={{ color: '#9cdcfe' }}>background</span>: <span style={{ color: '#ce9178' }}>palette</span>(<span style={{ color: '#9cdcfe' }}>surface-subtle</span>);
  <span style={{ color: '#9cdcfe' }}>border-radius</span>: <span style={{ color: '#ce9178' }}>radius</span>(<span style={{ color: '#b5cea8' }}>2</span>);
<span style={{ color: '#d4d4d4' }}>&#125;</span>

<span style={{ color: '#9cdcfe' }}>.prod-btn-primary</span> <span style={{ color: '#d4d4d4' }}>&#123;</span>
  <span style={{ color: '#c586c0' }}>@ds-button</span>(<span style={{ color: '#9cdcfe' }}>contained primary</span>);
  <span style={{ color: '#9cdcfe' }}>flex</span>: <span style={{ color: '#b5cea8' }}>1</span>;
  <span style={{ color: '#9cdcfe' }}>padding</span>: <span style={{ color: '#ce9178' }}>density</span>(<span style={{ color: '#b5cea8' }}>3</span>);
<span style={{ color: '#d4d4d4' }}>&#125;</span>`}</code>
              </pre>
              <div className="code-header" style={{ borderTop: '1px solid #333' }}>
                <span className="code-lang">HeroCard.tsx</span>
              </div>
              <pre>
                <code><span style={{ color: '#9cdcfe' }}>export</span> <span style={{ color: '#9cdcfe' }}>function</span> <span style={{ color: '#dcdcaa' }}>HeroCard</span>() <span style={{ color: '#d4d4d4' }}>&#123;</span>
  <span style={{ color: '#9cdcfe' }}>return</span> (
    <span style={{ color: '#569cd6' }}>&lt;div</span> <span style={{ color: '#9cdcfe' }}>className</span>=<span style={{ color: '#ce9178' }}>"prod-card"</span><span style={{ color: '#569cd6' }}>&gt;</span>
      <span style={{ color: '#569cd6' }}>&lt;div</span> <span style={{ color: '#9cdcfe' }}>className</span>=<span style={{ color: '#ce9178' }}>"prod-header"</span><span style={{ color: '#569cd6' }}>&gt;</span>
        <span style={{ color: '#569cd6' }}>&lt;div</span> <span style={{ color: '#9cdcfe' }}>className</span>=<span style={{ color: '#ce9178' }}>"prod-avatar"</span><span style={{ color: '#569cd6' }}>&gt;</span>JD<span style={{ color: '#569cd6' }}>&lt;/div&gt;</span>
        <span style={{ color: '#569cd6' }}>&lt;div</span> <span style={{ color: '#9cdcfe' }}>className</span>=<span style={{ color: '#ce9178' }}>"prod-info"</span><span style={{ color: '#569cd6' }}>&gt;</span>
          <span style={{ color: '#569cd6' }}>&lt;h3</span> <span style={{ color: '#9cdcfe' }}>className</span>=<span style={{ color: '#ce9178' }}>"prod-title"</span><span style={{ color: '#569cd6' }}>&gt;</span>Jane Doe<span style={{ color: '#569cd6' }}>&lt;/h3&gt;</span>
          <span style={{ color: '#569cd6' }}>&lt;p</span> <span style={{ color: '#9cdcfe' }}>className</span>=<span style={{ color: '#ce9178' }}>"prod-subtitle"</span><span style={{ color: '#569cd6' }}>&gt;</span>Senior UX Engineer<span style={{ color: '#569cd6' }}>&lt;/p&gt;</span>
        <span style={{ color: '#569cd6' }}>&lt;/div&gt;</span>
      <span style={{ color: '#569cd6' }}>&lt;/div&gt;</span>
      {<span style={{ color: '#6a9955' }}>/* ...stats &amp; actions... */</span>}
    <span style={{ color: '#569cd6' }}>&lt;/div&gt;</span>
  );
<span style={{ color: '#d4d4d4' }}>&#125;</span>`}</code>
              </pre>
            </>
          )}

          {activeTab === 'scss' && (
            <>
              <div className="code-header">
                <span className="code-lang">HeroCard.scss</span>
              </div>
              <div style={{ padding: '1rem', color: '#aaa', fontSize: '0.9rem', borderBottom: '1px solid #333' }}>
                {`/* Standard SCSS requires manual media queries and theme maps */`}
              </div>
              <pre>
                <code>{`.prod-card {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  margin: 0 auto;
  
  // Responsive width & padding
  width: 100%;
  padding: $spacing-3;
  
  @media (min-width: 768px) {
    width: 480px;
    padding: $spacing-5;
  }

  // Theming
  background-color: map-get($colors, surface-main);
  border-radius: $radius-3;
  box-shadow: $shadow-2;
  
  @media (prefers-color-scheme: dark) {
    background-color: map-get($colors, surface-dark);
    border-color: map-get($colors, border-dark);
  }
}

.prod-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: $spacing-3;

  @media (min-width: 640px) {
    flex-direction: row;
    text-align: left;
  }
}

// ... 50+ more lines for stats, buttons, typography ...`}</code>
              </pre>
            </>
          )}
        </div>
      </div>
    </section>
  )
}