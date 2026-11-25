'use client'

import Tabs from './Tabs'
import PaletteFamilyEditor from './PaletteFamilyEditor'
import ColorsEditor from './ColorsEditor'
import BreakpointsEditor from './BreakpointsEditor'
import DensityEditor from './DensityEditor'
import SpacingEditor from './SpacingEditor'
import TypographyEditor from './TypographyEditor'
import EdgesEditor from './EdgesEditor'
import ShadowsEditor from './ShadowsEditor'
import ThemeShowcase from './ThemeShowcase'
import ThemeConfigJsonEditor from './ThemeConfigJsonEditor'

/**
 * The Live theme handler: one editor per part of the theme, plus the whole theme as JSON.
 * Every tab reads and writes the same active theme (ThemeContext → applyTheme), so a change
 * in one shows in the others and on the page. A new editor (spacing, radii…) is a new tab.
 */
/** `showcase` puts the small UXDSL page above the tabs (/docs/theme); the home page has its own hero instead. */
export default function LiveThemeHandler({ showcase = true }: { showcase?: boolean }) {
  return (
    <>
      {/* The showcase first: a small page in UXDSL alone, which every tab below changes. */}
      {showcase && <ThemeShowcase />}
      <Tabs labels={['Colors / Palette', 'Breakpoints', 'Spacing / Density', 'Typography', 'Borders / Radii', 'Shadows', 'JSON']}>
        {/* Two editors, one tab: the Palette draws from the Colors, so a shade edited above moves the roles below. */}
        <div className="lth__stack">
          <ColorsEditor />
          <PaletteFamilyEditor />
        </div>
        <BreakpointsEditor />
        {/* Two editors, one tab: Density is built from Spacing, so an edit above shows below. */}
        <div className="lth__stack">
          <SpacingEditor />
          <DensityEditor />
        </div>
        <TypographyEditor />
        <EdgesEditor />
        <ShadowsEditor />
        <ThemeConfigJsonEditor />
      </Tabs>
    </>
  )
}
