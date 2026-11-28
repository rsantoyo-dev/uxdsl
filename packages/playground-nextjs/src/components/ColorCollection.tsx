'use client'

import { useMemo, type ButtonHTMLAttributes } from 'react'
import { tokenValueToCss } from 'uxdsl/engine'
import { colorRows } from '../lib/palette-editing'

type Row = { family: string; swatches: Array<{ key: string; label: string }> }

/**
 * One color of the active theme as a background: what `background: color(key)` or
 * `color(key, alpha)` compiles to, from the engine. The collection is the active theme's,
 * colors added in the JSON part included, so a swatch cannot be a class written ahead of time;
 * this is the one place that turns a color key into a style.
 */
export function ColorFill({ as = 'span', colorKey, alpha, ...rest }: { as?: 'span' | 'button'; colorKey: string; alpha?: number } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const Tag = as as 'button'
  return <Tag {...rest} style={{ background: tokenValueToCss(alpha === undefined ? `color(${colorKey})` : `color(${colorKey}, ${alpha})`) }} />
}

/**
 * The active theme's color collection as rows of swatches, one row per family (white and
 * black together as "named"). The Palette editor picks a shade from it for a role; the Colors
 * editor picks the shade to edit. The pressed swatch is `selectedKey`.
 */
export default function ColorCollection({
  colors,
  selectedKey,
  onPick,
  label,
  full = false,
}: {
  colors: Record<string, unknown> | undefined
  selectedKey: string | null
  onPick: (key: string) => void
  label: string
  /** Every family in view, no scrolling: the Colors editor, where the collection is the subject. */
  full?: boolean
}) {
  const rows: Row[] = useMemo(() => colorRows(colors), [colors])
  return (
    <div className={`ccl${full ? ' ccl--full' : ''}`} role="group" aria-label={label}>
      {rows.map((row) => (
        <div key={row.family} className="ccl__row">
          <span className="ccl__name">{row.family}</span>
          <div className="ccl__swatches">
            {row.swatches.map((swatch) => (
              <ColorFill
                as="button"
                key={swatch.key}
                colorKey={swatch.key}
                type="button"
                className="ccl__chip"
                aria-pressed={swatch.key === selectedKey}
                aria-label={`color(${swatch.key})`}
                title={`color(${swatch.key})`}
                onClick={() => onPick(swatch.key)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
