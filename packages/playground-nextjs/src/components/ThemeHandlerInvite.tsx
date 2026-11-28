import Link from 'next/link'
import { ArrowRight, SlidersHorizontal } from 'lucide-react'
import { THEME_HANDLER_HREF, THEME_PARTS, themePartHref } from '@/lib/theme-parts'
import ThemeSpecimen from './ThemeSpecimen'

const STEPS = [
  { title: 'Change it.', text: 'Rounder, roomier or deeper with one +, or any token of the theme.' },
  { title: 'Watch the site follow.', text: 'Live, on every page, in light and dark.' },
  { title: 'Take it home.', text: <>Download it as <code className="thi__code">uxdsl.theme.json</code>.</> },
]

/**
 * The home page's invitation to the Live theme handler (/docs/theme): what it is, in three
 * steps, one way in, and a shortcut to each part of the theme (each has an address; the
 * list and the drawings are the handler's own, src/lib/theme-parts.ts and ThemeSpecimen).
 * Static: the editor itself loads on its own page.
 */
export default function ThemeHandlerInvite() {
  return (
    <section className="thi" aria-labelledby="thi-title">
      <div className="thi__card">
        <div className="thi__intro">
          <p className="thi__eyebrow">
            <SlidersHorizontal size={14} aria-hidden="true" />
            Live theme handler
          </p>
          <h2 id="thi-title" className="thi__title">Visit our theme handler</h2>
          <p className="thi__lede">
            This whole site is one UXDSL theme. Change a color, a corner or a font and every page follows while you look at it.
            Then take the theme home as one JSON file.
          </p>
          <ol className="thi__steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className="thi__step">
                <span className="thi__num" aria-hidden="true">{index + 1}</span>
                <span><strong>{step.title}</strong> {step.text}</span>
              </li>
            ))}
          </ol>
          <Link href={THEME_HANDLER_HREF} className="thi__cta">
            Open the theme handler
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>

        <nav className="thi__parts" aria-label="Parts of the theme">
          <p className="thi__parts-title">Or go straight to a part of the theme</p>
          <ul className="thi__grid">
            {THEME_PARTS.map(({ id, label, hint }) => (
              <li key={id} className="thi__item">
                <Link href={themePartHref(id)} className="thi__tile">
                  <ThemeSpecimen id={id} />
                  <span className="thi__label">{label}</span>
                  <span className="thi__hint">{hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  )
}
