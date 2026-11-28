'use client'

import { useEffect, useMemo, useState } from 'react'
import { responsiveEntries } from 'uxdsl/language'
import { useTheme } from './ThemeContext'
import { useBreakpoints } from './BreakpointsProvider'
import { InteractiveDemoContainer } from './InteractiveDemoContainer'
import { densityKeys, lengthPx } from '../lib/density-editing'
import { spacingConsumers, consumerCount } from '../lib/spacing-editing'
import UsageExample, { jsonBlock, Result } from './UsageExample'
import { spacingUsage } from '../lib/usage-snippets'

const selected = (on: boolean) => (on ? ' is-selected' : '')

/** How a consumer is written where it is used. */
const FAMILY_LABEL: Record<string, string> = {
  densities: 'Densities',
  radii: 'Radii',
  borders: 'Borders',
  shadows: 'Shadows',
  typography_details: 'Typography',
  surfaces: 'Surfaces',
  buttons: 'Buttons',
  inputs: 'Inputs',
}
const reference = (family: string, path: string) =>
  family === 'densities' ? `density(${path})` : family === 'radii' ? `radius(${path})` : family === 'borders' ? `border(${path})` : family === 'shadows' ? `shadow(${path})` : path

/**
 * Edits the spacing scale of the active theme. Each step is drawn as a square of its size
 * (the real space(k), so it follows every edit), and the chosen one lists everything that
 * names it: a Density, a radius, a border or a text role moves with it, at the breakpoints
 * where it says space(k). Changes go through setCustomTheme → applyTheme like every part.
 */
export default function SpacingEditor() {
  const { activeThemeData, setCustomTheme, customThemeName } = useTheme()
  const { breakpoints } = useBreakpoints()
  const spacing: Record<string, string> = useMemo(() => activeThemeData?.spacing || {}, [activeThemeData])
  const keys = useMemo(() => densityKeys(spacing), [spacing])
  const [key, setKey] = useState('4')
  const value = spacing[key] ?? ''
  const [text, setText] = useState(value)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setText(value); setError(null) }, [value])

  const consumers = useMemo(() => spacingConsumers(activeThemeData, key, breakpoints, responsiveEntries), [activeThemeData, key, breakpoints])
  const counts = useMemo(
    () => Object.fromEntries(keys.map((k) => [k, consumerCount(spacingConsumers(activeThemeData, k, breakpoints, responsiveEntries))])),
    [activeThemeData, keys, breakpoints],
  )

  const apply = () => {
    const next = text.trim()
    if (!next || next === value) return
    if (typeof CSS !== 'undefined' && !CSS.supports('width', next)) {
      setError(`"${next}" is not a CSS length. A step is one value at every width: 0.75rem, 12px.`)
      return
    }
    try {
      setCustomTheme(customThemeName || 'Custom Theme', { spacing: { [key]: next } })
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const px = lengthPx(value, spacing)
  const usage = useMemo(() => spacingUsage(activeThemeData, key), [activeThemeData, key])

  return (
    <InteractiveDemoContainer
      title="Spacing"
      toolbar={
        <span className="spe__hint">
          The scale, drawn at 40%: one value per step, the same at every width. Densities, radii, borders and text roles name a
          step with <code>space(k)</code>, so changing one moves them.
        </span>
      }
    >
      <div className="spe">
        <div className="spe__scale" role="radiogroup" aria-label="Spacing step">
          {keys.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={k === key} className={`spe__step${selected(k === key)}`} onClick={() => setKey(k)}>
              <span className={`spe__square spe-size--${k}`} aria-hidden="true" />
              <code className="spe__name">space({k})</code>
              <span className="spe__value">{spacing[k]}</span>
              <span className="spe__count">{counts[k] ? `used ${counts[k]}×` : 'unused'}</span>
            </button>
          ))}
        </div>

        <div className="spe__editor">
          <div className="spe__real">
            <span className={`spe__square spe-real--${key}`} aria-hidden="true" />
            <span className="spe__real-label">real size</span>
          </div>
          <div className="spe__written">
            <code>spacing.{key}</code> = <code>{JSON.stringify(value)}</code>
            {px !== null && <span className="spe__px"> · {px}px</span>}
          </div>
          <label className="spe__field">
            <span>Value</span>
            <input
              type="text"
              className="spe__text"
              value={text}
              spellCheck={false}
              onChange={(event) => setText(event.target.value)}
              onBlur={apply}
              onKeyDown={(event) => { if (event.key === 'Enter') apply() }}
              aria-label={`spacing.${key}`}
            />
          </label>
          {error && <p className="spe__error" role="alert">{error}</p>}

          <div className="spe__consumers">
            <span className="spe__consumers-title">
              {consumerCount(consumers) ? <>Moves with <code>space({key})</code>:</> : <>Nothing in the theme names <code>space({key})</code>.</>}
            </span>
            {(Object.entries(consumers) as Array<[string, Array<{ path: string; breakpoints: string[] }>]>).map(([family, list]) => (
              <div key={family} className="spe__family">
                <span className="spe__family-name">{FAMILY_LABEL[family] ?? family}</span>
                <ul className="spe__list">
                  {list.map((item) => (
                    <li key={item.path} className="spe__consumer">
                      <code>{reference(family, item.path)}</code>
                      <span className="spe__at">at {item.breakpoints.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
      <UsageExample
        subject="Spacing"
        note={<>Use <code>space(k)</code> where a size should be the same at every width: an icon, a thumbnail, a rule. For the padding and gap of a component, name a Density (below) so it follows the breakpoints.</>}
        blocks={[{ label: 'In a stylesheet (.uxdsl)', code: usage.stylesheet }, jsonBlock(usage.excerpt)]}
      >
        <Result label=".icon"><span className={`spe__square spe-real--${key}`} aria-hidden="true" /></Result>
      </UsageExample>
    </InteractiveDemoContainer>
  )
}
