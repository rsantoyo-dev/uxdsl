'use client'

import type { ReactNode } from 'react'
import Tabs from './Tabs'
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
import TabGuide from './TabGuide'
import { THEME_TABS, type ThemeTabId } from '../lib/theme-tabs'

/**
 * Every tab (their order, labels and anchors are src/lib/theme-tabs.ts): what it is for and one
 * thing to try (TabGuide), then its editors, which end with "Use it in your project"
 * (UsageExample): the selection written as a stylesheet and as the part of uxdsl.theme.json
 * that defines it.
 */
const TABS: Record<ThemeTabId, { what: ReactNode; tryThis: ReactNode; content: ReactNode }> = {
  colors: {
    what: <>Colors are the raw collection; the Palette gives them jobs (primary, error, surface, text…). Components only name Palette roles, so recoloring a role recolors the whole site, in light and dark mode.</>,
    tryThis: <>Pick the primary role below and choose another shade for its main: every primary button, link and accent on the page follows. Then press Dark and do it again.</>,
    content: (
      // Two editors, one tab: the Palette draws from the Colors, so a shade edited above moves the roles below.
      <div className="lth__stack">
        <ColorsEditor />
        <PaletteFamilyEditor />
      </div>
    ),
  },
  breakpoints: {
    what: <>The widths where layouts switch. Every <code>md(…)</code> value and every <code>@media (--md)</code> block uses them.</>,
    tryThis: <>Drag md past your window&apos;s width: the showcase above the tabs and the example below switch layout at once.</>,
    content: <BreakpointsEditor />,
  },
  spacing: {
    what: <>Spacing is the scale of sizes; Density turns it into responsive spacing, a different step per breakpoint. Components use <code>density(n)</code> for padding and gap, so the whole site breathes together.</>,
    tryThis: <>Pick density 4 and give it a bigger step at xl: every card and section that uses it grows on wide screens only.</>,
    content: (
      // Two editors, one tab: Density is built from Spacing, so an edit above shows below.
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
    what: <>Containers composed from the tokens above: padding, corners, background, text, border and shadow in one role. A component writes <code>@ds-surface(outlined)</code>.</>,
    tryThis: <>Choose outlined, give its background palette(primary.light) and its corners radius(5): every outlined card changes.</>,
    content: <SurfacesEditor />,
  },
  controls: {
    what: <>Actions and fields: a Surface plus interaction states (hover, focus, selected, invalid, disabled), in any tone of the Palette.</>,
    tryThis: <>Set the contained hover background to palette(success.main), then hover the buttons, in every tone.</>,
    content: <ControlsEditor />,
  },
  json: {
    what: <>Everything above, as one JSON: the theme this page is running. It is what the download bar saves as your <code>uxdsl.theme.json</code>.</>,
    tryThis: <>Expand palette, then primary, and edit main: the page follows each valid edit, and the schema checks it as you type.</>,
    content: <ThemeConfigJsonEditor />,
  },
}

const TAB_LABELS = THEME_TABS.map((tab) => tab.label)
const TAB_IDS = THEME_TABS.map((tab) => tab.id)

/**
 * The Live theme handler, in the order a visitor uses it: QuickLooks changes several families
 * in one click, ThemeShowcase is a small page that shows every change, ThemeDownload takes
 * the result to a project as its uxdsl.theme.json, and the tabs hold one editor per part of
 * the theme plus the whole theme as JSON. Everything reads and writes the same active theme
 * (ThemeContext → applyTheme), so a change in one place shows in the others and on the page.
 * Each tab has an address (/docs/theme#surfaces).
 */
export default function LiveThemeHandler() {
  return (
    <>
      <div className="lth__top">
        <QuickLooks />
        {/* A small page in UXDSL alone, right under the looks, so one click shows at once. */}
        <ThemeShowcase />
        <ThemeDownload />
      </div>
      <div className="lth__byhand">
        <h2 className="lth__title">Fine-tune every part by hand</h2>
        <p className="lth__lede">
          One tab per part of the theme. Each says what it is for, gives you one thing to try, and ends with the code for your project.
        </p>
      </div>
      <Tabs labels={TAB_LABELS} ids={TAB_IDS}>
        {THEME_TABS.map((tab) => (
          <div key={tab.id} className="lth__tab">
            <TabGuide what={TABS[tab.id].what} tryThis={TABS[tab.id].tryThis} />
            {TABS[tab.id].content}
          </div>
        ))}
      </Tabs>
    </>
  )
}
