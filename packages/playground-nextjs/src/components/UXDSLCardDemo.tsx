'use client'
import React from 'react'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

const DEMO_CODE = `.uxdsl-card {
  @ds-surface (contained);
  width: xs(100%) md(450px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-radius: radius(3);
}

.card-header {
  background: palette(primary-main);
  padding: density(6);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background-size: density(8) density(8);
}

.logo-circle {
  @ds-surface (contained);
  width: density(11);
  height: density(11);
  border-radius: radius(full);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: color(gray-800);
}

.card-body {
  padding: density(5);
  display: flex;
  flex-direction: column;
  gap: density(3);
  text-align: center;
}

.card-title {
  @ds-typo (h4);
  color: palette(text-primary);
}

.card-desc {
  @ds-typo (body);
  color: palette(text-secondary);
}

.card-actions {
  padding: density(4);
  background: palette(surface-light);
  border-top: border(1);
  display: flex;
  gap: density(2);
  flex-direction: xs(column) sm(row);
}

.btn-primary {
  @ds-button (contained primary);
  flex: 1;
  justify-content: center;
}

.btn-secondary {
  @ds-button (outlined neutral);
  flex: 1;
  justify-content: center;
  background: palette(surface-main);
}`

export default function UXDSLCardDemo() {
  return (
    <div className="demo-container">
      <div className="uxdsl-card">
        <div className="card-header">
          <div className="logo-circle">
            <Image 
              src="/logo-uxdsl.png" 
              alt="UXDSL Logo" 
              width={50}
              height={50}
            />
          </div>
        </div>
        <div className="card-body">
          <h3 className="card-title">UX-DSL System</h3>
          <p className="card-desc">
            A type-safe, compile-time design system language that bridges the gap between design tokens and CSS implementation.
          </p>
        </div>
        <div className="card-actions">
          <button className="btn-secondary">
            Documentation
          </button>
          <button className="btn-primary">
            Get Started <ArrowRight size={16} style={{ marginLeft: 8 }} />
          </button>
        </div>
      </div>

      <div className="demo-code-block">
         <div className="code-header">
           <span className="code-file">CardComponent.uxdsl</span>
         </div>
         <SyntaxHighlighter 
            language="scss" 
            style={vscDarkPlus}
            customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.9rem' }}
            wrapLines={true}
          >
           {DEMO_CODE}
         </SyntaxHighlighter>
       </div>
    </div>
  )
}
