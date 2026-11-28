'use client'

import { ArrowRight } from 'lucide-react'
import { useTheme } from './ThemeContext'
import type { ThemePartId } from '../lib/theme-parts'

/**
 * The Live theme handler's showcase: a dummy page — a hero, a field, four cards — styled only
 * with UXDSL (ThemeShowcase.uxdsl). Its content is about what it is made of: the heading is
 * the h1 text role and shows the size the theme gives that role, and each card names the
 * token it is drawn with and opens the part of the handler that edits it. No inline style:
 * every color, space, type size and layout change is the theme's, so it follows each dial, each look and
 * each edit, and its layout changes at md and xl like any component built with UXDSL.
 */
const CARDS: { part: ThemePartId; tag: string; tone: string; title: string; body: string; link: string }[] = [
  { part: 'colors', tag: 'Palette', tone: 'secondary', title: 'Colors with a job', body: 'This card names roles. The theme says which color each one is, in light and dark.', link: 'Recolor a role' },
  { part: 'spacing', tag: 'Density', tone: 'info', title: 'Spacing per screen', body: 'Every gap here is a density token: one step of the scale per breakpoint.', link: 'Change a density' },
  { part: 'edges', tag: 'Radius', tone: 'success', title: 'Corners in one place', body: 'Round one radius token and every card, button and field rounds with it.', link: 'Round a corner' },
  { part: 'shadows', tag: 'Shadow', tone: 'warning', title: 'Depth as a token', body: 'These cards are raised by shadow(2). Edit its layers and they all move.', link: 'Lift a card' },
]

type TextRoles = Record<string, { fontSize?: string } | undefined>

export default function ThemeShowcase() {
  const { activeThemeData } = useTheme()
  // The size the theme on the page gives h1 (its own field, or the default role's): it changes as Typography is edited.
  const roles = ((activeThemeData as { typography_details?: TextRoles } | null)?.typography_details ?? {}) as TextRoles
  const h1Size = roles.h1?.fontSize ?? roles.default?.fontSize

  return (
    <div className="shw">
      <div className="shw__hero">
        <p className="shw__eyebrow">
          <code className="shw__role">@ds-typo(h1)</code>
          {h1Size && <code className="shw__size">{h1Size}</code>}
        </p>
        {/* The h1 text role on an h3: the role is how it looks, the element is where it sits in the page. */}
        <h3 className="shw__title">Handle your H1 dynamically!</h3>
        <p className="shw__subtitle">One text role, sized per breakpoint by the theme.</p>
        <div className="shw__actions">
          <a className="shw__primary" href="#typography">Edit this H1 <ArrowRight size={16} aria-hidden="true" /></a>
          <a className="shw__secondary" href="#colors">Recolor it</a>
        </div>
      </div>

      <div className="shw__side">
        <div className="shw__bar">
          <input className="shw__field" type="text" aria-label="A sample field" placeholder="A field: type here, focus it" />
          <button type="button" className="shw__send">A button</button>
          <span className="shw__bp">Layout at </span>
        </div>
        <div className="shw__cards">
          {CARDS.map((card) => (
            <article key={card.part} className="shw__card">
              <h4 className="shw__card-title">{card.title}</h4>
              <p className="shw__card-body">{card.body}</p>
              {/* Shown first: the token the card is about, and the way to its editor. */}
              <p className="shw__card-head">
                <span className={`shw__tag shw__tag--${card.tone}`}>{card.tag}</span>
                <a className="shw__card-link" href={`#${card.part}`}>{card.link} <ArrowRight size={12} aria-hidden="true" /></a>
              </p>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
