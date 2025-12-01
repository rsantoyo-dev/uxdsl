'use client'

import React from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

export default function HomeDemo() {
  return (
    <div id="HomeDemo" className="home-demo">
      {/* Preview */}
      <div className="mb-card">
        <div className="mb-header">
          <div className="mb-title-group">
            <h3>System Status</h3>
            <span className="mb-badge">Live</span>
          </div>
          <div className="mb-status-dot"></div>
        </div>
        
        <div className="mb-grid">
          <div className="mb-stat">
            <div className="mb-stat-header">
              <label>CPU Usage</label>
              <span>85%</span>
            </div>
            <div className="mb-bar"><div style={{width: '85%'}}></div></div>
          </div>
          <div className="mb-stat">
            <div className="mb-stat-header">
              <label>Memory</label>
              <span>62%</span>
            </div>
            <div className="mb-bar"><div style={{width: '62%'}}></div></div>
          </div>
        </div>

        <div className="mb-footer">
          <button className="mb-action">Run Diagnostics</button>
        </div>
      </div>

      <p className="mb-caption" style={{ textAlign: 'center', maxWidth: '400px', color: 'var(--ds__palette__text-secondary)', fontSize: '0.9rem' }}>
        <strong>Mind-blowing simplicity:</strong> This complex, responsive, themed component is built with just ~15 lines of UXDSL logic.
      </p>

      {/* Code */}
      <div className="home-code">
        <div className="code-header">
          <span className="code-lang">SystemStatus.uxdsl</span>
        </div>
        <div className="demo-code-block">
          <SyntaxHighlighter
            language="scss"
            style={vscDarkPlus}
            customStyle={{ margin: 0, borderRadius: '0 0 4px 4px' }}
          >
{`.mb-card {
  @ds-surface(bg);
  width: xs(100%) md(420px);
  padding: xs(density(3)) md(density(5));
  gap: density(4);
  display: flex; flex-direction: column;

  .mb-header { 
    display: flex; justify-content: space-between; 
    h3 { @ds-typo(h5); margin: 0; }
  }
  
  .mb-badge {
    @ds-typo(caption);
    background: palette(success-light, 0.2);
    color: palette(success-dark);
    border-radius: radius(full);
  }

  .mb-status-dot {
    background: palette(success-main);
    border-radius: radius(full);
    animation: pulse 2s infinite;
  }

  .mb-action {
    @ds-button(contained primary);
    width: 100%;
  }
}`}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  )
}
