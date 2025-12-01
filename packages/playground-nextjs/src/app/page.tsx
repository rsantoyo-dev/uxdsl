'use client'

import Link from 'next/link'
import { ArrowRight, Github, Mail, Package } from 'lucide-react'
import { UXDSLLogo } from '@/components/UXDSLLogo'
import { PageTitle } from '@/components/PageTitle'
import UXDSLCardDemo from '@/components/UXDSLCardDemo'

export default function Home() {
  return (
    <main id="WelcomePage">
      <div className="hero-surface">
        <div className="hero-content">
          <div className="logo-container">
            <UXDSLLogo className="hero-logo" />
          </div>
          <PageTitle 
            title="UX-DSL" 
            subtitle="UX Design System Language"
            className="welcome-page-title"
          />
        </div>
      </div>
      
      <div className="content-container">
        <div className="actions">
          <Link href="/docs/home" className="get-started-btn">
            Get Started <ArrowRight size={20} />
          </Link>
        </div>

        <div className="intro-section">
          <p className="intro-text">
            A type-safe, compile-time design system language that bridges the gap between 
            design tokens and CSS implementation. Write expressive, token-aware styles 
            that compile to optimized CSS.
          </p>
        </div>

        <div className="demo-section">
          <h3 className="section-label">See it in action</h3>
          <div className="demo-wrapper-scale">
            <UXDSLCardDemo />
          </div>
        </div>
      </div>

      <footer className="welcome-footer">
        <div className="footer-links">
          <a href="https://github.com/rsantoyo-dev/uxdsl" target="_blank" rel="noopener noreferrer" className="footer-link">
            <Github size={20} />
            <span>GitHub</span>
          </a>
          <a href="https://www.npmjs.com/search?q=uxdsl" target="_blank" rel="noopener noreferrer" className="footer-link">
            <Package size={20} />
            <span>Packages</span>
          </a>
          <a href="mailto:ricardo.santoyo@hotmail.com" className="footer-link">
            <Mail size={20} />
            <span>Contact</span>
          </a>
        </div>
        <div className="footer-copy">
          © {new Date().getFullYear()} Ricardo Santoyo. MIT License.
        </div>
      </footer>
    </main>
  )
}