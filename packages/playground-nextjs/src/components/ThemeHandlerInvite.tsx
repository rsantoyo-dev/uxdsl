import Link from 'next/link'
import { ArrowRight, SlidersHorizontal } from 'lucide-react'
import { THEME_HANDLER_HREF, THEME_TABS, themeTabHref, type ThemeTabId } from '@/lib/theme-tabs'

/**
 * What each part of the theme is called on the home page and what a visitor does with it.
 * Keyed by tab id, so a tab added to src/lib/theme-tabs.ts fails here until it has a tile.
 */
const PARTS: Record<ThemeTabId, { label: string; hint: string }> = {
  colors: { label: 'Colors & palette', hint: 'Recolor a role, light and dark' },
  breakpoints: { label: 'Breakpoints', hint: 'Move where layouts switch' },
  spacing: { label: 'Spacing & density', hint: 'Let the whole site breathe' },
  typography: { label: 'Typography', hint: 'Change fonts and the type scale' },
  edges: { label: 'Borders & radii', hint: 'Round or sharpen every corner' },
  shadows: { label: 'Shadows', hint: 'Lift or flatten every card' },
  surfaces: { label: 'Surfaces', hint: 'Restyle every container' },
  controls: { label: 'Buttons & inputs', hint: 'Every state of every control' },
  json: { label: 'JSON', hint: 'The whole theme, as one file' },
}

const STEPS = [
  { title: 'Change it.', text: 'A one-click look, or any token of the theme.' },
  { title: 'Watch the site follow.', text: 'Live, on every page, in light and dark.' },
  { title: 'Take it home.', text: <>Download it as <code className="thi__code">uxdsl.theme.json</code>.</> },
]

/**
 * A small drawing of each part, made of the very tokens it edits: it changes with the theme
 * like everything else on the page. Decoration only; the tile's text says what it is.
 */
function Specimen({ id }: { id: ThemeTabId }) {
  switch (id) {
    case 'colors':
      return (
        <>
          {(['primary', 'secondary', 'success', 'warning'] as const).map((tone) => (
            <span key={tone} className={`thi__dot thi__dot--${tone}`} />
          ))}
        </>
      )
    case 'breakpoints':
      return <span className="thi__bp" />
    case 'spacing':
      return (
        <>
          <span className="thi__step-box thi__step-box--3" />
          <span className="thi__step-box thi__step-box--5" />
          <span className="thi__step-box thi__step-box--7" />
        </>
      )
    case 'typography':
      return <span className="thi__type">Aa</span>
    case 'edges':
      return <span className="thi__edge" />
    case 'shadows':
      return <span className="thi__shadow" />
    case 'surfaces':
      return <span className="thi__surface" />
    case 'controls':
      return <span className="thi__button">Button</span>
    case 'json':
      return <span className="thi__json">{'{ }'}</span>
  }
}

/**
 * The home page's invitation to the Live theme handler (/docs/theme): what it is, in three
 * steps, one way in, and a shortcut to each part of the theme (its tabs have addresses).
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
            {THEME_TABS.map(({ id }) => (
              <li key={id} className="thi__item">
                <Link href={themeTabHref(id)} className="thi__tile">
                  <span className="thi__spec" aria-hidden="true"><Specimen id={id} /></span>
                  <span className="thi__label">{PARTS[id].label}</span>
                  <span className="thi__hint">{PARTS[id].hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  )
}
