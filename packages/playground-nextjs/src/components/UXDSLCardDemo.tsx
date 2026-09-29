'use client'

import styles from './UXDSLCardDemo.module.css'
import { scopedClasses } from '../lib/uxdsl-module-classes'
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
    color: palette(primary-main);
  }

  .card-desc {
    @ds-typo (body);
    color: palette(primary-main);
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
    <div className={scopedClasses("uxdsl-demo-wrapper", styles)}>
      <div className={scopedClasses("uxdsl-card", styles)}>
        <div className={scopedClasses("card-header", styles)}>
          <div className={scopedClasses("logo-circle", styles)}>
            <UXDSLLogo className={scopedClasses("card-logo", styles)} />
          </div>
        </div>
        <div className={scopedClasses("card-body", styles)}>
          <h5 className={scopedClasses("card-title", styles)}>UX-DSL</h5>
          <p className={scopedClasses("card-desc", styles)}>
            A build-time design system language that keeps components connected
            to shared tokens and semantic roles.
          </p>
        </div>
        <div className={scopedClasses("card-actions", styles)}>
          <Link href="/docs/quick-start" className={scopedClasses("btn-secondary", styles)}>
            Documentation
          </Link>
          <Link href="/docs/quick-start" className={scopedClasses("btn-primary", styles)}>
            Get Started <ArrowRight size={16} className={scopedClasses("btn-primary__icon", styles)} />
          </Link>
        </div>
      </div>

      <div className={scopedClasses("demo-code-block", styles)}>
        <div className={scopedClasses("code-header", styles)}>
          <span className={scopedClasses("code-file", styles)}>CardComponent.uxdsl</span>
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
