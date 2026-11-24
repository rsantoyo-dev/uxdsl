'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Github, Pause, Play } from 'lucide-react'
import { GITHUB_URL } from '@/lib/docs'
import { BANNERS, type Banner } from '@/lib/hero-banners'

const ROTATE_MS = 8000
const FAMILIES = ['primary', 'secondary', 'success', 'info', 'warning', 'error']
const VARIANTS = ['light', 'main', 'dark']
const TYPE_ROLES = ['h1', 'h3', 'body', 'caption']

/** What a banner shows next to its text: a part of the theme, drawn with UXDSL only. */
function Showcase({ show }: { show: Banner['show'] }) {
  if (show === 'palette') {
    return (
      <div className="hf-palette" aria-label="Palette roles: light, main and dark">
        <div className="hf-palette__row" aria-hidden="true">
          <span />
          {VARIANTS.map((variant) => <code key={variant} className="hf-palette__head">{variant}</code>)}
        </div>
        {FAMILIES.map((family) => (
          <div key={family} className="hf-palette__row">
            <code className="hf-palette__name">{family}</code>
            {VARIANTS.map((variant) => (
              <span
                key={variant}
                className={`hf-palette__chip hf-fill--${family}-${variant}`}
                title={`palette(${family}.${variant})`}
                role="img"
                aria-label={`palette(${family}.${variant})`}
              />
            ))}
          </div>
        ))}
      </div>
    )
  }
  if (show === 'type') {
    return (
      <div className="hf-type">
        {TYPE_ROLES.map((role) => (
          <div key={role} className="hf-type__row">
            <code className="hf-type__role">@ds-typo({role})</code>
            <span className={`hf-type__sample hf-typo--${role}`}>The quick brown fox</span>
          </div>
        ))}
      </div>
    )
  }
  if (show === 'density') {
    return (
      <div className="hf-density hf-density--6">
        <code className="hf-density__label">density(6)</code>
        <div className="hf-density hf-density--4">
          <code className="hf-density__label">density(4)</code>
          <div className="hf-density hf-density--2">
            <code className="hf-density__label">density(2)</code>
            <span className="hf-density__content">content</span>
          </div>
        </div>
      </div>
    )
  }
  if (show === 'roles') {
    return (
      <div className="hf-roles">
        <div className="hf-roles__buttons">
          <button type="button" className="hf-btn-contained">Contained</button>
          <button type="button" className="hf-btn-outlined">Outlined</button>
          <button type="button" className="hf-btn-secondary">Secondary</button>
        </div>
        <input className="hf-input" placeholder="@ds-input(outlined)" aria-label="An outlined input" />
        <div className="hf-card">
          <span className="hf-card__title">@ds-surface(contained)</span>
          <span className="hf-card__text">Padding, corners, colors, border and shadow: one line.</span>
        </div>
      </div>
    )
  }
  return (
    <div className="hf-responsive">
      <span className="hf-responsive__bp">Layout at </span>
      <div className="hf-responsive__grid">
        <span className="hf-responsive__cell">One</span>
        <span className="hf-responsive__cell">Two</span>
        <span className="hf-responsive__cell">Three</span>
      </div>
      <code className="hf-responsive__code">grid-template-columns: xs(1fr) md(repeat(3, 1fr));</code>
    </div>
  )
}

/**
 * The home page's hero: a feed of banners (src/lib/hero-banners.ts), one at a time, each
 * showing a part of the theme in its own tone, layout and density. Everything is UXDSL
 * (HeroFeed.uxdsl), so the Live theme handler below changes it as you edit. It moves on by
 * itself and stops while the pointer or focus is on it, when paused, and for anyone who
 * asked for reduced motion.
 */
export default function HeroFeed() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [reduced, setReduced] = useState(false)
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const read = () => setReduced(query.matches)
    read()
    query.addEventListener('change', read)
    return () => query.removeEventListener('change', read)
  }, [])

  useEffect(() => {
    if (paused || hovered || reduced) return
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % BANNERS.length), ROTATE_MS)
    return () => window.clearTimeout(timer)
  }, [index, paused, hovered, reduced])

  const banner = BANNERS[index]

  return (
    <section
      ref={root}
      className="hf"
      aria-roledescription="carousel"
      aria-label="UXDSL"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={(event) => { if (!root.current?.contains(event.relatedTarget as Node)) setHovered(false) }}
    >
      <div className="hf__head">
        <h1 className="hf__brand">UXDSL <span className="hf__tagline">CSS with a theme</span></h1>
        <div className="hf__ctas">
          <Link href="/docs/quick-start" className="hf__cta hf__cta--primary">
            Quick start <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link href="/docs/introduction" className="hf__cta">Docs</Link>
          <a href={GITHUB_URL} className="hf__cta" target="_blank" rel="noopener noreferrer">
            <Github size={18} aria-hidden="true" /> GitHub
          </a>
        </div>
      </div>

      <div
        key={banner.id}
        className={`hf-banner hf-tone--${banner.tone} hf-layout--${banner.layout} hf-pad--${banner.density}`}
        role="group"
        aria-roledescription="slide"
        aria-label={`${index + 1} of ${BANNERS.length}: ${banner.title}`}
      >
        <div className="hf-banner__text">
          <code className="hf-banner__eyebrow">{banner.eyebrow}</code>
          <h2 className="hf-banner__title">{banner.title}</h2>
          <p className="hf-banner__body">{banner.text}</p>
        </div>
        <div className="hf-banner__show">
          <Showcase show={banner.show} />
        </div>
      </div>

      <div className="hf__controls">
        <button type="button" className="hf__pause" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play the banners' : 'Pause the banners'}>
          {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
        </button>
        <div className="hf__dots">
          {BANNERS.map((b, i) => (
            <button
              key={b.id}
              type="button"
              className={`hf__dot${i === index ? ' is-selected' : ''}`}
              aria-label={`Banner ${i + 1}: ${b.title}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
