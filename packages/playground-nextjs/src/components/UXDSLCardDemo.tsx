'use client'
import React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { UXDSLLogo } from '@/components/UXDSLLogo'

const DEMO_CODE = `.uxdsl-card {
    @ds-surface (contained);
    width: xs(100%) md(400px);
    border-radius: radius(3);
    box-shadow: shadow(3);
    transition: all 0.2s;
    overflow: hidden;
  }

  .card-header {
    background: linear-gradient(135deg, palette(primary-main), palette(primary-dark));
    padding: density(6);
    display: grid;
    place-items: center;
  }

  .logo-circle {
    @ds-surface (contained light);
    width: density(10);
    height: density(10);
    border-radius: radius(full);
    display: grid;
    place-items: center;
    box-shadow: shadow(2);
  }

  .card-logo {
    width: 60%;
    height: auto;
  }

  .card-body {
    padding: density(5);
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: density(3);
  }

  .card-title {
    @ds-typo (h5);
    color: palette(text-primary);
  }

  .card-desc {
    @ds-typo (body);
    color: palette(text-secondary);
  }

  .card-actions {
    padding: density(4);
    border-top: border(1);
    display: flex;
    gap: density(2);
  }

  .btn-primary {
    @ds-button (contained primary);
    width: 100%;
    justify-content: center;
  }

  .btn-secondary {
    @ds-button (outlined neutral);
    width: 100%;
    justify-content: center;
  }`;

export default function UXDSLCardDemo() {
  return (
    <div className="uxdsl-demo-wrapper">
      <div className="uxdsl-card">
        <div className="card-header">
          <div className="logo-circle">
            <UXDSLLogo className="card-logo" />
          </div>
        </div>
        <div className="card-body">
          <h5 className="card-title">UX-DSL</h5>
          <p className="card-desc">
            A type-safe, compile-time design system language that bridges the
            gap between design tokens and CSS implementation.
          </p>
        </div>
        <div className="card-actions">
          <Link href="/docs/quick-start" className="btn-secondary">
            Documentation
          </Link>
          <Link href="/docs/quick-start" className="btn-primary">
            Get Started <ArrowRight size={16} style={{ marginLeft: 8 }} />
          </Link>
        </div>
      </div>

      <div className="demo-code-block">
        <div className="code-header">
          <span className="code-file">CardComponent.uxdsl</span>
        </div>
        <SyntaxHighlighter
          language="scss"
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: "1rem",
            background: "transparent",
            fontSize: "0.9rem",
          }}
          wrapLines={true}
        >
          {DEMO_CODE}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
