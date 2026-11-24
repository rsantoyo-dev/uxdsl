'use client'

import Tabs from './Tabs'
import PaletteFamilyEditor from './PaletteFamilyEditor'
import BreakpointsEditor from './BreakpointsEditor'
import DensityEditor from './DensityEditor'
import SpacingEditor from './SpacingEditor'
import ThemeConfigJsonEditor from './ThemeConfigJsonEditor'

/**
 * The Live theme handler: one editor per part of the theme, plus the whole theme as JSON.
 * Every tab reads and writes the same active theme (ThemeContext → applyTheme), so a change
 * in one shows in the others and on the page. A new editor (spacing, radii…) is a new tab.
 */
export default function LiveThemeHandler() {
  return (
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
  )
}
