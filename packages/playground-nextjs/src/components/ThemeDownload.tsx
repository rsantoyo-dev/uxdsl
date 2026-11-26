'use client'

import { useMemo } from 'react'
import { Download } from 'lucide-react'
import { useTheme } from './ThemeContext'
import { useBreakpoints } from './BreakpointsProvider'
import { withBreakpoints } from '../lib/breakpoint-preview'
import { FILE_NAME, themeDiff, themeFamilies, themeFileText, leafCount } from '../lib/theme-download'
import { baseTheme } from '../../themes'

function save(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = FILE_NAME
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * The Live theme handler's way out: the theme on the page as a `uxdsl.theme.json`, ready to
 * sit next to a project's `uxdsl.config.cjs`. By default the file holds only what differs
 * from UXDSL's base theme (src/lib/theme-download.js); "Whole theme" writes every family.
 * The page's breakpoints go in it, the previewed ones included: the next build moves them.
 */
export default function ThemeDownload() {
  const { activeThemeData } = useTheme()
  const { breakpoints, preview } = useBreakpoints()
  const theme = useMemo(() => withBreakpoints(activeThemeData, breakpoints), [activeThemeData, breakpoints])
  // The hint counts what differs from this site's own base (UXDSL's, plus the site's color
  // collection), so a page nobody edited says so; the file itself is measured from UXDSL's.
  const changed = useMemo(() => leafCount(themeDiff(themeFamilies(baseTheme), themeFamilies(theme))), [theme])

  return (
    <div className="tdl">
      <div className="tdl__text">
        <strong className="tdl__title">Take this theme to your project</strong>
        <span className="tdl__hint">
          {changed === 0 ? 'No changes yet' : `${changed} ${changed === 1 ? 'change' : 'changes'}`}
          {preview ? ', the previewed breakpoints included' : ''}. The file holds what differs from UXDSL’s base theme, this site’s
          color collection included. Put <code className="tdl__code">{FILE_NAME}</code> next to <code className="tdl__code">uxdsl.config.cjs</code>{' '}
          and rebuild.
        </span>
      </div>
      <div className="tdl__buttons">
        <button type="button" className="tdl__button tdl__button--primary" onClick={() => save(themeFileText(theme))}>
          <Download size={14} aria-hidden="true" /> Download {FILE_NAME}
        </button>
        <button type="button" className="tdl__button" onClick={() => save(themeFileText(theme, { full: true }))} title="Every family, not only what changed">
          Whole theme
        </button>
      </div>
    </div>
  )
}
