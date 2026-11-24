import Link from 'next/link'
import { Github, Package, Mail } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'
import ParadigmFrame from '@/components/ParadigmFrame'
import { AIPrompt } from '@/components/AIPrompt'
import HeroFeed from '@/components/HeroFeed'
import LiveThemeHandler from '@/components/LiveThemeHandler'
import { GITHUB_URL, NPM_URL } from '@/lib/docs'
import generated from '@/generated/examples.json'

// The example, its theme excerpt and its compiled CSS all come from
// src/generated/examples.json, written by scripts/capture-examples.js with the real
// compiler (and re-checked by `npm test`). The card in the frame is the same file.
const paradigm = generated.examples.paradigm
const themeExcerpt = JSON.stringify(JSON.parse(paradigm.theme), null, 2)

const PILLARS = [
  { href: '/docs/spacing', title: 'Tokens that step', text: 'Spacing, density, type, radii and shadows are defined once with their breakpoint progression. A component names the token.' },
  { href: '/docs/surfaces', title: 'Roles, not recipes', text: '@ds-surface, @ds-button and @ds-input apply a role from the theme: padding, corners, colors, border, shadow and states.' },
  { href: '/docs/diagnostics', title: 'Nothing silent', text: 'An unknown token, breakpoint or role stops the build with a UXD_* code, the file, line and column, and what exists instead.' },
  { href: '/docs/runtime', title: 'One JSON, three uses', text: 'The theme the build compiles is the one applyTheme changes in the browser and uxdsl theme --contrast audits.' },
]

export default function Home() {
  return (
    <main className="home">
      <HeroFeed />

      <section className="home-live" aria-labelledby="home-live-title">
        <h2 id="home-live-title" className="home-section-title">Edit the theme, watch it change</h2>
        <p className="home-live__text">
          The banners above are UXDSL only. Change a color, a spacing step, a density or a breakpoint below and they follow —
          through <code>applyTheme</code>, the same call your app makes. Nothing is saved: export the JSON for your theme file.
        </p>
        <LiveThemeHandler showcase={false} />
      </section>

      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__intro">
          <p className="home-hero__eyebrow">How it works</p>
          <h2 id="home-title" className="home-hero__title">Breakpoints belong to the theme, not to your components.</h2>
          <p className="home-hero__lede">
            Spacing, type and color — and how each of them steps at a breakpoint — are defined once in a theme JSON.
            Components name them. The compiler writes the media queries and refuses any reference it cannot resolve.
          </p>
        </div>

        <div className="home-hero__code">
          <div className="home-code">
            <p className="home-code__label">The theme <span className="home-code__path">uxdsl.theme.json</span></p>
            <CodeBlock language="json" code={themeExcerpt} />
            <p className="home-code__label">UXDSL you write <span className="home-code__path">card.uxdsl</span></p>
            <CodeBlock language="scss" code={paradigm.source} />
          </div>
          <div className="home-code">
            <p className="home-code__label">CSS you get <span className="home-code__path">compiled by uxdsl</span></p>
            <div className="home-code__scroll" tabIndex={0} aria-label="The compiled CSS (scrollable)">
              <CodeBlock language="css" code={paradigm.output} />
            </div>
          </div>
        </div>

        <div className="home-hero__frame">
          <p className="home-hero__frame-hint">
            Drag the frame&apos;s right edge (or the slider). The card has no breakpoint in it; its padding and title step at the theme&apos;s.
          </p>
          <ParadigmFrame breakpoints={paradigm.breakpoints} />
        </div>
      </section>

      <section className="home-pillars" aria-labelledby="home-pillars-title">
        <h2 id="home-pillars-title" className="home-section-title">What the theme decides</h2>
        <div className="home-pillars__grid">
          {PILLARS.map((pillar) => (
            <Link key={pillar.href} href={pillar.href} className="home-pillar">
              <h3 className="home-pillar__title">{pillar.title}</h3>
              <p className="home-pillar__text">{pillar.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-experiment" aria-labelledby="home-experiment-title">
        <h2 id="home-experiment-title" className="home-section-title">Experiment: a theme from a name</h2>
        <p className="home-experiment__text">
          Type a name and a language model writes a theme override for this site; it is validated and applied with
          <code> applyTheme</code>, like the header&apos;s theme buttons. It changes values only — the components are not rebuilt.
        </p>
        <AIPrompt />
      </section>

      <footer className="home-footer">
        <div className="home-footer__links">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="home-footer__link">
            <Github size={18} aria-hidden="true" /> GitHub
          </a>
          <a href={NPM_URL} target="_blank" rel="noopener noreferrer" className="home-footer__link">
            <Package size={18} aria-hidden="true" /> npm
          </a>
          <a href="mailto:ricardo.santoyo@hotmail.com" className="home-footer__link">
            <Mail size={18} aria-hidden="true" /> Contact
          </a>
        </div>
        <p className="home-footer__copy">© {new Date().getFullYear()} Ricardo Santoyo. MIT License.</p>
      </footer>
    </main>
  )
}
