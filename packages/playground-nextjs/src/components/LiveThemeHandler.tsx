'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react'
import PaletteFamilyEditor from './PaletteFamilyEditor'
import ColorsEditor from './ColorsEditor'
import BreakpointsEditor from './BreakpointsEditor'
import DensityEditor from './DensityEditor'
import SpacingEditor from './SpacingEditor'
import TypographyEditor from './TypographyEditor'
import EdgesEditor from './EdgesEditor'
import ShadowsEditor from './ShadowsEditor'
import SurfacesEditor from './SurfacesEditor'
import ControlsEditor from './ControlsEditor'
import ThemeShowcase from './ThemeShowcase'
import ThemeConfigJsonEditor from './ThemeConfigJsonEditor'
import ThemeDownload from './ThemeDownload'
import QuickLooks from './QuickLooks'
import PartGuide from './PartGuide'
import ThemeSpecimen from './ThemeSpecimen'
import { useTheme } from './ThemeContext'
import { useBreakpoints } from './BreakpointsProvider'
import { withBreakpoints } from '../lib/breakpoint-preview'
import { themeDiff, themeFamilies } from '../lib/theme-download'
import { partChanges, partFacts } from '../lib/theme-part-facts'
import { THEME_PARTS, type ThemePartId } from '../lib/theme-parts'
import { baseTheme } from '../../themes'

/**
 * What every part holds once it is open (their order, names and anchors are
 * src/lib/theme-parts.ts): what it is for and one thing to try (PartGuide), then its editors,
 * which end with "Use it in your project" (UsageExample): the selection written as a
 * stylesheet and as the part of uxdsl.theme.json that defines it.
 */
const PARTS: Record<ThemePartId, { what: ReactNode; tryThis: ReactNode; content: ReactNode }> = {
  palette: {
    what: <>The Palette gives colors their jobs (primary, error, surface, text…). Components only name Palette roles, so recoloring a role recolors the whole site, in light and dark mode.</>,
    tryThis: <>Pick the primary role below and choose another shade for its main: every primary button, link and accent on the page follows. Then press Dark and do it again.</>,
    content: <PaletteFamilyEditor />,
  },
  colors: {
    what: <>Colors are the raw collection: families of shades (<code>color(gray.300)</code>) and single colors. The Palette draws from them, so a shade edited here moves every role that names it.</>,
    tryThis: <>Edit a shade the Palette uses, purple 700 in the default theme: the primary role, and everything primary on the page, follows.</>,
    content: <ColorsEditor />,
  },
  breakpoints: {
    what: <>The widths where layouts switch. Every <code>md(…)</code> value and every <code>@media (--md)</code> block uses them.</>,
    tryThis: <>Drag md past your window&apos;s width: the example below and the showcase at the top of the page switch layout at once.</>,
    content: <BreakpointsEditor />,
  },
  spacing: {
    what: <>Spacing is the scale of sizes; Density turns it into responsive spacing, a different step per breakpoint. Components use <code>density(n)</code> for padding and gap, so the whole site breathes together.</>,
    tryThis: <>Pick density 4 and give it a bigger step at xl: every card and section that uses it grows on wide screens only.</>,
    content: (
      // Two editors, one part: Density is built from Spacing, so an edit above shows below.
      <div className="lth__stack">
        <SpacingEditor />
        <DensityEditor />
      </div>
    ),
  },
  typography: {
    what: <>Text roles (h1 to caption) with their size, weight, line height and font, per breakpoint. A component writes <code>@ds-typo(h1)</code> and gets them all.</>,
    tryThis: <>Choose another font for ui, then make h1 bigger at xl: every heading on the page follows.</>,
    content: <TypographyEditor />,
  },
  edges: {
    what: <>Edges and corners as tokens: <code>border(n)</code> is a width, a style and a color; <code>radius(n)</code> a corner, per breakpoint.</>,
    tryThis: <>Pick radius 2 and, in the row marked &quot;your window&quot;, choose space(6): cards, buttons and fields round together.</>,
    content: <EdgesEditor />,
  },
  shadows: {
    what: <>Depth as tokens: <code>shadow(n)</code> is a list of layers, each an offset, a blur, a spread and a color.</>,
    tryThis: <>Pick shadow 2 and drag the blur of its second layer: every raised card and menu changes depth.</>,
    content: <ShadowsEditor />,
  },
  surfaces: {
    what: <>Containers composed from the other tokens: padding, corners, background, text, border and shadow in one role. A component writes <code>@ds-surface(outlined)</code>.</>,
    tryThis: <>Choose outlined, give its background palette(primary.light) and its corners radius(5): every outlined card changes.</>,
    content: <SurfacesEditor />,
  },
  controls: {
    what: <>Actions and fields: a Surface plus interaction states (hover, focus, selected, invalid, disabled), in any tone of the Palette.</>,
    tryThis: <>Set the contained hover background to palette(success.main), then hover the buttons, in every tone.</>,
    content: <ControlsEditor />,
  },
  json: {
    what: <>Every part, as one JSON: the theme this page is running. It is what the download bar saves as your <code>uxdsl.theme.json</code>.</>,
    tryThis: <>Expand palette, then primary, and edit main: the page follows each valid edit, and the schema checks it as you type.</>,
    content: <ThemeConfigJsonEditor />,
  },
}

const isPart = (id: string): id is ThemePartId => THEME_PARTS.some((part) => part.id === id)

/** The address names the open part, without adding a history entry (Back still leaves the page). */
function writeHash(id: ThemePartId | null) {
  window.history.replaceState(window.history.state, '', id ? `#${id}` : window.location.pathname + window.location.search)
}

/** Brings a part's header under the page's bars, unless the visitor asked for less motion. */
function scrollToPart(id: ThemePartId) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' })
}

/**
 * The Live theme handler. On top, ThemeShowcase is a dummy page that shows every change.
 * QuickLooks steps a whole family with − and +, or changes several in one click, and lists the
 * themes every edit is saved as (SavedThemes). Right under it, every part of the theme
 * is a row that opens and closes: its header shows a drawing made of the part's own tokens, a
 * few facts read from the theme on the page and how many of its values were changed, so the
 * rows already follow a dial or a look before any is opened; open, a row holds the part's editors.
 * ThemeDownload takes the result to a project as its uxdsl.theme.json. Everything reads and
 * writes the same active theme (ThemeContext → applyTheme), so a change in one place shows in
 * the others and on the page.
 *
 * Each part has an address (/docs/theme#surfaces opens Surfaces). Several can be open at
 * once, and an editor is loaded the first time its part opens, then kept.
 */
export default function LiveThemeHandler() {
  const { activeThemeData } = useTheme()
  const { breakpoints } = useBreakpoints()
  // The theme as the page uses it, the previewed breakpoints included, like the download.
  const theme = useMemo(() => withBreakpoints(activeThemeData, breakpoints), [activeThemeData, breakpoints])
  const facts = useMemo(() => partFacts(theme) as Record<ThemePartId, string[]>, [theme])
  // What differs from this site's own theme: the visitor's changes, and nothing else.
  const changes = useMemo(
    () => partChanges(themeDiff(themeFamilies(baseTheme), themeFamilies(theme))) as Record<ThemePartId, number>,
    [theme],
  )
  // A part that was opened is listed: true while it is open. Its editors stay once loaded.
  // The Palette starts open: it is the part that changes a page fastest.
  const [rows, setRows] = useState<Partial<Record<ThemePartId, boolean>>>({ palette: true })
  const anyOpen = Object.values(rows).some(Boolean)

  // #surfaces opens Surfaces, on arrival and whenever the address changes (the browser scrolls to it).
  useEffect(() => {
    const follow = () => {
      const id = window.location.hash.slice(1)
      if (isPart(id)) setRows((now) => (now[id] ? now : { ...now, [id]: true }))
    }
    follow()
    window.addEventListener('hashchange', follow)
    return () => window.removeEventListener('hashchange', follow)
  }, [])

  const toggle = (id: ThemePartId) => {
    const open = !rows[id]
    setRows((now) => ({ ...now, [id]: open }))
    if (open) {
      writeHash(id)
      // A header low on the screen would open onto nothing: bring it up, once its panel is laid out.
      const top = document.getElementById(id)?.getBoundingClientRect().top ?? 0
      if (top > window.innerHeight * 0.4) requestAnimationFrame(() => scrollToPart(id))
    } else if (window.location.hash === `#${id}`) {
      writeHash(null)
    }
  }
  // From the end of a long panel: close it and go back to its header.
  const close = (id: ThemePartId) => {
    setRows((now) => ({ ...now, [id]: false }))
    if (window.location.hash === `#${id}`) writeHash(null)
    requestAnimationFrame(() => scrollToPart(id))
  }
  const closeAll = () => {
    setRows((now) => Object.fromEntries(Object.keys(now).map((id) => [id, false])))
    if (isPart(window.location.hash.slice(1))) writeHash(null)
  }

  return (
    <div className="lth">
      <section id="showcase" className="lth__watch" aria-labelledby="lth-watch-title">
        <div className="lth__head">
          <h2 id="lth-watch-title" className="lth__title">Watch a page follow</h2>
          <p className="lth__lede">A dummy page built with UXDSL alone. Every − and + and every edit below reaches it through <code>applyTheme</code>, the runtime API your project gets too.</p>
        </div>
        <ThemeShowcase />
      </section>

      <QuickLooks />

      <section className="lth__byhand" aria-labelledby="lth-byhand-title">
        <div className="lth__head">
          <h2 id="lth-byhand-title" className="lth__title">
            <SlidersHorizontal size={20} className="lth__title-icon" aria-hidden="true" />
            Fine-tune every part by hand
          </h2>
          <p className="lth__lede">The Palette is open. Open any other part: what it is for, one thing to try, its editor and the code for your project.</p>
          {anyOpen && (
            <button type="button" className="lth__close-all" onClick={closeAll}>
              Close all
            </button>
          )}
        </div>
        <div className="lth__parts">
          {THEME_PARTS.map(({ id, label, hint }) => {
            const open = Boolean(rows[id])
            return (
              <section key={id} id={id} className={`lth__part${open ? ' is-open' : ''}`} aria-labelledby={`${id}-header`}>
                <h3 className="lth__part-heading">
                  <button
                    type="button"
                    id={`${id}-header`}
                    className="lth__part-header"
                    aria-expanded={open}
                    aria-controls={`${id}-panel`}
                    onClick={() => toggle(id)}
                  >
                    <span className="lth__part-spec"><ThemeSpecimen id={id} /></span>
                    <span className="lth__part-name">
                      <span className="lth__part-label">{label}</span>
                      <span className="lth__part-hint">{hint}</span>
                    </span>
                    <span className="lth__part-facts">
                      {facts[id].map((fact) => (
                        <span key={fact} className="lth__fact">{fact}</span>
                      ))}
                    </span>
                    {changes[id] > 0 && <span className="lth__part-changed">{changes[id]} changed</span>}
                    <ChevronDown size={18} className="lth__part-chevron" aria-hidden="true" />
                  </button>
                </h3>
                <div id={`${id}-panel`} className="lth__part-panel" hidden={!open}>
                  {id in rows && (
                    <>
                      <PartGuide what={PARTS[id].what} tryThis={PARTS[id].tryThis} />
                      {PARTS[id].content}
                      <button type="button" className="lth__part-close" onClick={() => close(id)}>
                        <ChevronUp size={14} aria-hidden="true" /> Close {label}
                      </button>
                    </>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </section>

      <ThemeDownload />
    </div>
  )
}
