'use client'

import { useEffect, useMemo, useState } from 'react'
import { responsiveEntries, resolveResponsiveValue, inspectResponsiveValue } from 'uxdsl/language'
import { getDensityTokens } from 'uxdsl/engine'
import { useTheme } from './ThemeContext'
import { useBreakpoints } from './BreakpointsProvider'
import { InteractiveDemoContainer } from './InteractiveDemoContainer'
import { lengthPx, buildDefinition, densityKeys, spaceKeyOf } from '../lib/density-editing'
import UsageExample, { jsonBlock, Result } from './UsageExample'
import { densityUsage } from '../lib/usage-snippets'

const CONTENT_PX = 40
const selected = (on: boolean) => (on ? ' is-selected' : '')

/**
 * Edits one Density token of the active theme. The squares draw what it gives at each
 * breakpoint, one around the same content; the example below uses it for real
 * (padding and gap: density(n)), so it follows the window. Every change goes through
 * setCustomTheme → applyTheme, like the other tabs, and shows in the JSON tab.
 */
export default function DensityEditor() {
  const { activeThemeData, setCustomTheme, customThemeName } = useTheme()
  const { breakpoints } = useBreakpoints()
  const tokens = useMemo(() => getDensityTokens(activeThemeData), [activeThemeData])
  const keys = useMemo(() => densityKeys(tokens), [tokens])
  const [key, setKey] = useState('4')
  const definition: string = tokens[key] ?? ''
  const order = useMemo(() => Object.keys(breakpoints).sort((a, b) => breakpoints[a] - breakpoints[b]), [breakpoints])
  const spacing: Record<string, string> = activeThemeData?.spacing || {}
  const spaceKeys = useMemo(() => densityKeys(spacing), [spacing])

  const [text, setText] = useState(definition)
  const [error, setError] = useState<string | null>(null)
  const [viewport, setViewport] = useState<number | null>(null)
  useEffect(() => { setText(definition); setError(null) }, [definition])
  useEffect(() => {
    const read = () => setViewport(window.innerWidth)
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])

  // What each breakpoint says, and what applies there (a breakpoint that says nothing keeps the previous value).
  const entries = useMemo(() => responsiveEntries(definition, breakpoints), [definition, breakpoints])
  const rows = order.map((bp) => {
    const value = resolveResponsiveValue(definition, bp, breakpoints)
    return { bp, written: entries[bp] ?? '', value, px: lengthPx(value, spacing) }
  })
  // A step smaller than the breakpoint before it: usually a spacing edit that overtook this token's progression.
  const shrinks = (index: number) => index > 0 && rows[index].px !== null && rows[index - 1].px !== null && (rows[index].px as number) < (rows[index - 1].px as number)
  const active = viewport === null ? null : inspectResponsiveValue(definition, viewport, breakpoints).active

  const write = (next: string) => {
    const value = next.trim()
    if (!value || value === definition) return
    try {
      setCustomTheme(customThemeName || 'Custom Theme', { densities: { [key]: value } })
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }
  const setAt = (bp: string, value: string) => write(buildDefinition({ ...entries, [bp]: value }, order))

  // The drawing: one square per breakpoint around the same content, the widest at the back.
  const drawn = rows.filter((row) => row.px !== null) as Array<(typeof rows)[number] & { px: number }>
  const widest = Math.max(0, ...drawn.map((row) => row.px))
  const size = CONTENT_PX + 2 * widest + 8
  const square = (px: number) => ({ at: (size - CONTENT_PX - 2 * px) / 2, side: CONTENT_PX + 2 * px })

  const usage = useMemo(() => densityUsage(activeThemeData, key), [activeThemeData, key])
  return (
    <InteractiveDemoContainer
      title="Density"
      toolbar={
        <div className="dte__toolbar">
          <div className="dte__keys" role="radiogroup" aria-label="Density token">
            {keys.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={k === key} className={`dte__key${selected(k === key)}`} onClick={() => setKey(k)}>
                {k}
              </button>
            ))}
          </div>
          <span className="dte__hint">Pick a token: the squares show what <code>density({key})</code> gives at each breakpoint.</span>
        </div>
      }
    >
      <div className="dte">
        <div className="dte__drawing">
          <svg className="dte__svg" viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`density(${key}) at each breakpoint`}>
            {[...drawn].sort((a, b) => b.px - a.px).map((row) => {
              const { at, side } = square(row.px)
              const index = order.indexOf(row.bp)
              return (
                <rect
                  key={row.bp}
                  className={`dte__ring dte__ring--${index % 5}${active === row.bp ? ' is-active' : ''}`}
                  x={at}
                  y={at}
                  width={side}
                  height={side}
                  rx={4}
                />
              )
            })}
            <rect className="dte__content" x={(size - CONTENT_PX) / 2} y={(size - CONTENT_PX) / 2} width={CONTENT_PX} height={CONTENT_PX} rx={2} />
          </svg>

          <ul className="dte__legend">
            {rows.map((row, index) => (
              <li key={row.bp} className={`dte__legend-row${active === row.bp ? ' is-active' : ''}`}>
                <span className={`dte__dot dte__dot--${index % 5}`} aria-hidden="true" />
                <code className="dte__bp">{row.bp}</code>
                <code className="dte__value">{row.value || '—'}</code>
                <span className="dte__px">{row.px === null ? 'not drawn' : `${row.px}px`}</span>
                <span className={`dte__tag${shrinks(index) ? ' is-warning' : ''}`}>
                  {shrinks(index) ? `smaller than ${rows[index - 1].bp}` : active === row.bp ? 'your window' : row.written ? '' : 'keeps the previous'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="dte__editor">
          <div className="dte__written">
            <code>densities.{key}</code> = <code>{JSON.stringify(definition)}</code>
          </div>

          <div className="dte__rows">
            {order.map((bp, index) => {
              const written = entries[bp] ?? ''
              const custom = written && spaceKeyOf(written) === null
              return (
                <label key={bp} className="dte__row">
                  <span className={`dte__dot dte__dot--${index % 5}`} aria-hidden="true" />
                  <code className="dte__bp">{bp}</code>
                  <select className="dte__select" value={written} onChange={(event) => setAt(bp, event.target.value)} aria-label={`density(${key}) from ${bp}`}>
                    {index > 0 && <option value="">keeps the previous</option>}
                    {custom && <option value={written}>{written}</option>}
                    {spaceKeys.map((s) => (
                      <option key={s} value={`space(${s})`}>space({s}) · {spacing[s]}</option>
                    ))}
                  </select>
                </label>
              )
            })}
          </div>

          <label className="dte__field">
            <span>Or write the definition</span>
            <input
              type="text"
              className="dte__text"
              value={text}
              spellCheck={false}
              onChange={(event) => setText(event.target.value)}
              onBlur={() => write(text)}
              onKeyDown={(event) => { if (event.key === 'Enter') write(text) }}
              aria-label={`densities.${key}`}
            />
          </label>
          {error && <p className="dte__error" role="alert">{error}</p>}
        </div>

      </div>
      <UsageExample
        note={<>One token, a different step at each breakpoint: the component never writes a media query.</>}
        blocks={[{ label: 'In a stylesheet (.uxdsl)', code: usage.stylesheet }, jsonBlock(usage.excerpt)]}
      >
        <Result label={`.card · .stack: density(${key}) at your window`} wide>
          <div className={`dte__demo dte-use--${key}`}>
            <span className="dte__item">One</span>
            <span className="dte__item">Two</span>
            <span className="dte__item">Three</span>
          </div>
        </Result>
      </UsageExample>
    </InteractiveDemoContainer>
  )
}
