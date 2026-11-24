'use client'

import Tabs from './Tabs'
import PaletteFamilyEditor from './PaletteFamilyEditor'
import BreakpointsEditor from './BreakpointsEditor'
import DensityEditor from './DensityEditor'
import SpacingEditor from './SpacingEditor'
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
      <Tabs labels={['Palette', 'Breakpoints', 'Spacing / Density', 'JSON']}>
        <PaletteFamilyEditor />
        <BreakpointsEditor />
        {/* Two editors, one tab: Density is built from Spacing, so an edit above shows below. */}
        <div className="lth__stack">
          <SpacingEditor />
          <DensityEditor />
        </div>
        <ThemeConfigJsonEditor />
      </Tabs>
    </>
  )
}
