'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Github, Mail, Package, BookOpen, Rocket, Palette, Type, Grid3X3, Smartphone } from 'lucide-react'
import { InteractiveLogo } from '@/components/InteractiveLogo'
import { HeroBackground } from '@/components/HeroBackground'
import { PageTitle } from '@/components/PageTitle'
import UXDSLCardDemo from '@/components/UXDSLCardDemo'
import NavigationCardLink from '@/components/NavigationCardLink'

export default function Home() {
  const [mousePos, setMousePos] = useState<{x: number | null, y: number | null}>({ x: null, y: null })
  const [isPressed, setIsPressed] = useState(false)
  
  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseLeave = () => {
    setMousePos({ x: null, y: null })
    setIsPressed(false)
  }

  const handleMouseDown = () => setIsPressed(true)
  const handleMouseUp = () => setIsPressed(false)

  return (
    <main id="WelcomePage">
      <div 
        className="hero-surface"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        <HeroBackground mouseX={mousePos.x} mouseY={mousePos.y} isPressed={isPressed} />
        
        <div className="hero-content" style={{ position: 'relative', zIndex: 1 }}>
          <div className="logo-container">
            <InteractiveLogo 
              className="hero-logo" 
              mouseX={mousePos.x}
              mouseY={mousePos.y}
            />
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

        <div className="nav-grid">
          <NavigationCardLink
            href="/docs/quick-start"
            title="Quick Start"
            description="Get up and running with UX-DSL in minutes."
            icon={<Rocket size={24} />}
            variant="primary"
          />
          <NavigationCardLink
            href="/docs/home"
            title="Documentation"
            description="Explore the comprehensive guides and API references."
            icon={<BookOpen size={24} />}
            variant="secondary"
          />
          <NavigationCardLink
            href="/docs/palette"
            title="Palette"
            description="Explore the color system and semantic tokens."
            icon={<Palette size={24} />}
            variant="secondary"
          />
          <NavigationCardLink
            href="/docs/typography"
            title="Typography"
            description="Master the fluid typography system."
            icon={<Type size={24} />}
            variant="secondary"
          />
          <NavigationCardLink
            href="/docs/densities"
            title="Densities"
            description="Manage spacing and sizing across different contexts."
            icon={<Grid3X3 size={24} />}
            variant="secondary"
          />
          <NavigationCardLink
            href="/docs/breakpoints"
            title="Breakpoints"
            description="Responsive design breakpoints and layout rules."
            icon={<Smartphone size={24} />}
            variant="secondary"
          />
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