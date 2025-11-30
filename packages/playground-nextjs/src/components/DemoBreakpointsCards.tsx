'use client'

import React from 'react'

export default function DemoBreakpointsCards() {
  return (
    <div id="DemoBreakpointsCards" className="demo-breakpoints-cards">
      <div className="demo-breakpoints-card-item">
        <div className="demo-breakpoints-card-icon--primary">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>
        </div>
        <div className="demo-breakpoints-card-title">Fluid Layout</div>
        <div className="demo-breakpoints-card-text">Layouts that flow naturally across device sizes.</div>
      </div>

      <div className="demo-breakpoints-card-item">
        <div className="demo-breakpoints-card-icon--secondary">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
        </div>
        <div className="demo-breakpoints-card-title">Adaptive</div>
        <div className="demo-breakpoints-card-text">Styles that change based on the viewport width.</div>
      </div>

      <div className="demo-breakpoints-card-item">
        <div className="demo-breakpoints-card-icon--info">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
        </div>
        <div className="demo-breakpoints-card-title">Modular</div>
        <div className="demo-breakpoints-card-text">Component-based design for maximum reusability.</div>
      </div>
    </div>
  )
}
