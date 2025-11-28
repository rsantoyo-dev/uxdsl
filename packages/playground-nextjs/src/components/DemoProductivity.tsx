'use client'

import React, { useState } from 'react'

export default function DemoProductivity() {
  const [activeTab, setActiveTab] = useState<'uxdsl' | 'tailwind' | 'scss'>('uxdsl')

  return (
    <section className="demo-section">
      <div className="demo-header">
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
                <code>{`.prod-card {
  @ds-surface(contained);
  
  /* Responsive Layout */
  display: flex;
  flex-direction: column;
  width: xs(100%) md(480px);
  padding: xs(density(3)) md(density(5));
  gap: density(4);
  margin: 0 auto;
}

.prod-header {
  display: flex;
  flex-direction: xs(column) sm(row);
  align-items: center;
  text-align: xs(center) sm(left);
  gap: density(3);
}

.prod-avatar {
  width: 80px;
  height: 80px;
  border-radius: radius(full);
  background: palette(primary-main);
  color: palette(primary-contrast);
  /* ...flex centering... */
}

.prod-stats {
  display: flex;
  justify-content: space-around;
  padding: density(3) 0;
  background: palette(surface-subtle);
  border-radius: radius(2);
}

.prod-btn-primary {
  @ds-button(contained primary);
  flex: 1;
  padding: density(3);
}`}</code>
              </pre>
              <div className="code-header" style={{ borderTop: '1px solid #333' }}>
                <span className="code-lang">HeroCard.tsx</span>
              </div>
              <pre>
                <code>{`export function HeroCard() {
  return (
    <div className="prod-card">
      <div className="prod-header">
        <div className="prod-avatar">JD</div>
        <div className="prod-info">
          <h3 className="prod-title">Jane Doe</h3>
          <p className="prod-subtitle">Senior UX Engineer</p>
        </div>
      </div>
      {/* ...stats & actions... */}
    </div>
  );
}`}</code>
              </pre>
            </>
          )}

          {activeTab === 'tailwind' && (
            <>
              <div className="code-header">
                <span className="code-lang">HeroCard (Tailwind)</span>
              </div>
              <div style={{ padding: '1rem', color: '#aaa', fontSize: '0.9rem', borderBottom: '1px solid #333' }}>
                {`/* Real-world comparison: UXDSL tokens are responsive by default.
   Matching that behavior in Tailwind requires 3x the utility classes. */`}
              </div>
              <pre>
                <code>{`<div class="
  flex flex-col mx-auto
  w-full md:w-[480px]
  
  /* Responsive Spacing (matching density tokens) */
  gap-4 md:gap-5 xl:gap-6
  p-3 md:p-6 xl:p-7
  
  /* Theming & Dark Mode */
  bg-white dark:bg-slate-900
  rounded-xl shadow-md
  border border-gray-200 dark:border-gray-700
">
  <div class="
    flex flex-col sm:flex-row 
    items-center text-center sm:text-left 
    gap-3 md:gap-4 xl:gap-5
  ">
    <div class="
      w-20 h-20 rounded-full 
      bg-blue-600 text-white 
      flex items-center justify-center 
      text-2xl font-bold shadow-lg 
      border-4 border-white dark:border-slate-900
    ">JD</div>
    
    <div class="flex flex-col gap-2">
      <h3 class="text-xl font-bold text-gray-900 dark:text-white">
        Jane Doe
      </h3>
      <p class="text-sm uppercase tracking-wider font-semibold text-gray-500">
        Senior UX Engineer
      </p>
    </div>
  </div>

  <div class="
    flex justify-around 
    py-3 md:py-4 xl:py-5
    bg-gray-50 dark:bg-slate-800 
    rounded-lg border-y border-gray-200
  ">
    <!-- Stats... -->
  </div>

  <div class="flex flex-col sm:flex-row gap-4">
    <button class="
      flex-1 
      p-3 md:p-4 xl:p-5
      bg-blue-600 hover:bg-blue-700 
      text-white rounded-lg font-medium
    ">Follow</button>
  </div>
</div>`}</code>
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