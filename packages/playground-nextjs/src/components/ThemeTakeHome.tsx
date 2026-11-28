'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import UsageExample, { Result, jsonBlock, type UsageBlock } from './UsageExample'
import { useTheme } from './ThemeContext'
import { useBreakpoints } from './BreakpointsProvider'
import { withBreakpoints } from '../lib/breakpoint-preview'
import { FILE_NAME, SCHEMA, themeDiff, themeFamilies, leafCount } from '../lib/theme-download'
import { baseTheme } from '../../themes'

/** A new project, from nothing to this page's look. The commands are the Quick start's. */
const INSTALL: UsageBlock[] = [
  { label: '1. Install UXDSL and scaffold it', code: 'npm i -D uxdsl\nnpx uxdsl init' },
  {
    label: '2. Put the downloaded file next to the config',
    code: `your-project/\n├─ uxdsl.config.cjs\n├─ ${FILE_NAME}   ← from this page\n└─ src/\n   └─ styles.uxdsl`,
  },
  { label: '3. Build', code: 'npx uxdsl build' },
]

/**
 * "From this page to your project", under the Live theme handler: one component of this site,
 * shown as it is written (`source` is src/components/plan-card.uxdsl, read and compiled by
 * scripts/capture-examples.js), the card that stylesheet styles, live, and what the visitor
 * changed above, as the theme file a project would hold. Then the three steps that take it
 * there. The card and the file follow every edit made on the page.
 */
export default function ThemeTakeHome({ source }: { source: string }) {
  const { activeThemeData } = useTheme()
  const { breakpoints } = useBreakpoints()
  // What differs from this site's own theme: the visitor's changes, and nothing else.
  const changes = useMemo(
    () => themeDiff(themeFamilies(baseTheme), themeFamilies(withBreakpoints(activeThemeData, breakpoints))),
    [activeThemeData, breakpoints],
  )
  const changed = leafCount(changes)

  return (
    <section id="take-home" className="tth" aria-labelledby="tth-title">
      <h2 id="tth-title" className="tth__title">From this page to your project</h2>
      <p className="tth__lede">
        The card below is a component of this site. Its stylesheet names roles and tokens, never a color, a size or a breakpoint,
        so it follows whatever you change above. Your components do the same with the file you download.
      </p>

      <UsageExample
        title="One component, any theme"
        blocks={[
          { label: 'plan-card.uxdsl: the component, written once', code: source.trim() },
          jsonBlock({ $schema: SCHEMA, ...changes }, `${FILE_NAME}: what you changed on this page`),
        ]}
        note={
          changed === 0
            ? 'Nothing changed yet. Press + on a dial at the top of the page: the card changes, and the theme file below fills in.'
            : `${changed} ${changed === 1 ? 'value' : 'values'} changed so far. The card follows them. The file below shows only those changes; the one you download adds this site's color collection, so every color() reference in it resolves in your project too.`
        }
      >
        <Result label=".plan-card" wide>
          <article className="plan-card">
            <h4 className="plan-card__title">Team plan</h4>
            <p className="plan-card__text">Shared themes, every role and token, and one file to hand to the next project.</p>
            <button type="button" className="plan-card__action">Choose Team</button>
          </article>
        </Result>
      </UsageExample>

      <UsageExample
        title="Three steps to your project"
        blocks={INSTALL}
        note={
          <>
            The build merges your file over UXDSL&apos;s base theme, so it only has to hold what you changed. The{' '}
            <Link href="/docs/quick-start" className="tth__link">Quick start</Link> has the same steps for Next.js, Vite and Webpack.
          </>
        }
      />
    </section>
  )
}
