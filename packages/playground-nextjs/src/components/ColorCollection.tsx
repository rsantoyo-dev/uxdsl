'use client'

import { useMemo } from 'react'
import { colorRows, colorVar } from '../lib/palette-editing'

type Row = { family: string; swatches: Array<{ key: string; label: string }> }

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
              <button
                key={swatch.key}
                type="button"
                className="ccl__chip"
                aria-pressed={swatch.key === selectedKey}
                aria-label={`color(${swatch.key})`}
                title={`color(${swatch.key})`}
                // The collection is the active theme's, colors added in the JSON tab included,
                // so a swatch cannot be a class written ahead of time.
                style={{ background: colorVar(swatch.key) }}
                onClick={() => onPick(swatch.key)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
