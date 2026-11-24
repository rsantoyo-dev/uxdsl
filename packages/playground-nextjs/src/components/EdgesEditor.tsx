'use client'

import { useEffect, useMemo, useState } from 'react'
import { responsiveEntries, resolveResponsiveValue, inspectResponsiveValue } from 'uxdsl/language'
import { generateEdgeCss, getEdgeTokens } from 'uxdsl/engine'
import { useTheme } from './ThemeContext'
import { useBreakpoints } from './BreakpointsProvider'
import { InteractiveDemoContainer } from './InteractiveDemoContainer'
import { lengthPx, buildDefinition, densityKeys, spaceKeyOf } from '../lib/density-editing'
import { STYLES, KINDS, parseBorder, buildBorder, edgeKeys, edgePatch, edgeConsumers, borderColorOptions } from '../lib/edge-editing'

type Kind = 'borders' | 'radii'

// EdgesEditor.uxdsl generates one class per token of the base theme, border(n) and radius(n),
// so every box below is the token itself and follows each edit. A key the base theme does
// not have (one added in the JSON tab) has no class: it is listed, and drawn plain.
const PREVIEW_KEYS = ['0', '1', '2', '3', '4', '5']
const tokenClass = (kind: Kind, key: string) => (PREVIEW_KEYS.includes(key) ? `ede-${kind === 'borders' ? 'border' : 'radius'}--${key}` : '')
const selected = (on: boolean) => (on ? ' is-selected' : '')
const WIDTHS = ['1px', '2px', '3px']

/** One breakpoint of a Border: width, style and color, each a control; `none` or another shape as written. */
function BorderRow({ bp, index, written, inherited, spacing, spaceKeys, colors, active, onSet }: {
  bp: string
  index: number
  written: string
  inherited: string
  spacing: Record<string, string>
  spaceKeys: string[]
  colors: { label: string; values: string[] }[]
  active: boolean
  onSet: (value: string) => void
}) {
  const parts = parseBorder(written)
  // A breakpoint that says nothing starts from what it shows now, the value it keeps.
  const start = parseBorder(inherited) || { width: '1px', style: 'solid', color: colors[0]?.values[0] ?? 'currentcolor' }
  const width = written.trim().toLowerCase() === 'none' ? 'none' : parts ? parts.width : written ? '__written' : ''
  const setWidth = (value: string) => {
    if (value === '') return onSet('')
    if (value === 'none') return onSet('none')
    onSet(buildBorder({ ...(parts || start), width: value }))
  }
  const widthOptions = [...WIDTHS, ...spaceKeys.filter((k) => k !== '0').map((k) => `space(${k})`)]

  return (
    <div className={`ede__row${active ? ' is-active' : ''}`} title={active ? 'Your window' : undefined}>
      <code className="ede__bp">{bp}</code>
      <select className="ede__select" value={width} onChange={(event) => setWidth(event.target.value)} aria-label={`Width from ${bp}`}>
        {index > 0 && <option value="">keeps the previous</option>}
        {width === '__written' && <option value="__written">{written}</option>}
        {parts && !widthOptions.includes(parts.width) && <option value={parts.width}>{parts.width}</option>}
        <option value="none">none</option>
        {widthOptions.map((w) => <option key={w} value={w}>{spaceKeyOf(w) ? `${w} · ${spacing[spaceKeyOf(w) as string]}` : w}</option>)}
      </select>
      {parts ? (
        <>
          <select className="ede__select" value={parts.style} onChange={(event) => onSet(buildBorder({ ...parts, style: event.target.value }))} aria-label={`Style from ${bp}`}>
            {STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="ede__select" value={parts.color} onChange={(event) => onSet(buildBorder({ ...parts, color: event.target.value }))} aria-label={`Color from ${bp}`}>
            {!colors.some((group) => group.values.includes(parts.color)) && <option value={parts.color}>{parts.color}</option>}
            {colors.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.values.map((c) => <option key={c} value={c}>{c}</option>)}
              </optgroup>
            ))}
          </select>
        </>
      ) : (
        <span className="ede__as-written">{written ? (width === 'none' ? 'no border' : 'as written: edit the definition below') : `keeps ${inherited || '—'}`}</span>
      )}
    </div>
  )
}

/**
 * Edits the Border and Radius tokens of the active theme (`borders`, `radii`). Every token is
 * drawn live, a card, a button and a field show the chosen one on real components, and its
 * value can be set per breakpoint: for a Border its width, style and color, for a Radius its
 * size. Changes go through setCustomTheme → applyTheme like every tab, and show in the JSON tab.
 */
export default function EdgesEditor() {
  const { activeThemeData, setCustomTheme, customThemeName } = useTheme()
  const { breakpoints } = useBreakpoints()
  const tokens = useMemo(() => getEdgeTokens(activeThemeData) as Record<Kind, Record<string, string>>, [activeThemeData])
  const [kind, setKind] = useState<Kind>('radii')
  const [key, setKey] = useState('2')
  const keys = useMemo(() => edgeKeys(tokens[kind]), [tokens, kind])
  useEffect(() => { if (keys.length && !keys.includes(key)) setKey(keys.includes('1') ? '1' : keys[0]) }, [keys, key])

  const fn = KINDS[kind].fn
  const definition: string = tokens[kind][key] ?? ''
  const spacing: Record<string, string> = activeThemeData?.spacing || {}
  const spaceKeys = useMemo(() => densityKeys(spacing), [spacing])
  const order = useMemo(() => Object.keys(breakpoints).sort((a, b) => breakpoints[a] - breakpoints[b]), [breakpoints])
  const colors = useMemo(() => borderColorOptions(activeThemeData), [activeThemeData])
  const consumers = useMemo(() => edgeConsumers(activeThemeData, kind, key), [activeThemeData, kind, key])

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

  const entries = useMemo(() => responsiveEntries(definition, breakpoints), [definition, breakpoints])
  const active = viewport === null || !definition ? null : inspectResponsiveValue(definition, viewport, breakpoints).active

  /** Writes the token; the engine compiles it first, so a value it cannot read is refused with its message. */
  const write = (next: string) => {
    const value = next.trim()
    if (!value) return setError('A token needs a value: 0 for a square corner, border(0) is none.')
    if (value === definition) return
    try {
      generateEdgeCss({ ...activeThemeData, [kind]: { ...tokens[kind], [key]: value } }, breakpoints)
      setCustomTheme(customThemeName || 'Custom Theme', edgePatch(kind, key, value))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }
  const setAt = (bp: string, value: string) => write(buildDefinition({ ...entries, [bp]: value }, order))
  const pick = (next: Kind) => { setKind(next); setKey(next === 'radii' ? '2' : '1') }

  return (
    <InteractiveDemoContainer
      title="Borders / Radii"
      toolbar={
        <div className="ede__toolbar">
          <div className="ede__kinds" role="radiogroup" aria-label="Token family">
            {(Object.keys(KINDS) as Kind[]).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={k === kind} className={`ede__kind${selected(k === kind)}`} onClick={() => pick(k)}>
                {KINDS[k].label}
              </button>
            ))}
          </div>
          <span className="ede__hint">
            Pick a token: every box is <code>{fn}(n)</code> itself, and the card, button and field use <code>{fn}({key})</code>.
          </span>
        </div>
      }
    >
      <div className="ede">
        <div className="ede__preview">
          <div className="ede__gallery" role="radiogroup" aria-label={`${KINDS[kind].label} tokens`}>
            {keys.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={k === key} className={`ede__tile${selected(k === key)}`} onClick={() => setKey(k)}>
                <span className={`ede__box ede__box--${kind} ${tokenClass(kind, k)}`} aria-hidden="true" />
                <code className="ede__tile-name">{fn}({k})</code>
              </button>
            ))}
          </div>

          <div className="ede__stage">
            <code className="ede__stage-label">
              {fn}({key}) on real components · your window{active ? `: ${active}` : ''}
            </code>
            <div className="ede__samples">
              <div className={`ede__card ede-${kind === 'borders' ? 'b' : 'r'}--${key}`}>
                <span className="ede__card-title">@ds-surface(contained)</span>
                <span className="ede__card-text">then {kind === 'borders' ? 'border' : 'border-radius'}: {fn}({key});</span>
              </div>
              <button type="button" className={`ede__button ede-${kind === 'borders' ? 'b' : 'r'}--${key}`}>A button</button>
              <input className={`ede__input ede-${kind === 'borders' ? 'b' : 'r'}--${key}`} placeholder="A field" aria-label="A sample field" />
            </div>
          </div>
        </div>

        <div className="ede__editor">
          <code className="ede__written">{kind}.{key}</code>
          <div className="ede__rows">
            {order.map((bp, index) => {
              const written = entries[bp] ?? ''
              const inherited = resolveResponsiveValue(definition, bp, breakpoints) ?? ''
              if (kind === 'borders') {
                return (
                  <BorderRow key={bp} bp={bp} index={index} written={written} inherited={inherited} spacing={spacing}
                    spaceKeys={spaceKeys} colors={colors} active={active === bp} onSet={(value) => setAt(bp, value)} />
                )
              }
              const px = lengthPx(inherited, spacing)
              const custom = written && written !== '0' && spaceKeyOf(written) === null
              return (
                <div key={bp} className={`ede__row${active === bp ? ' is-active' : ''}`}>
                  <code className="ede__bp">{bp}</code>
                  <select className="ede__select" value={written} onChange={(event) => setAt(bp, event.target.value)} aria-label={`Radius from ${bp}`}>
                    {index > 0 && <option value="">keeps the previous</option>}
                    {custom && <option value={written}>{written}</option>}
                    <option value="0">0 · square</option>
                    {spaceKeys.filter((s) => s !== '0').map((s) => <option key={s} value={`space(${s})`}>space({s}) · {spacing[s]}</option>)}
                  </select>
                  <span className="ede__px">{px === null ? inherited || '—' : `${px}px`}{written ? '' : ' (kept)'}{active === bp ? ' · your window' : ''}</span>
                </div>
              )
            })}
          </div>

          <label className="ede__definition">
            <span className="ede__title">The definition</span>
            <input
              type="text"
              className="ede__text"
              value={text}
              spellCheck={false}
              onChange={(event) => setText(event.target.value)}
              onBlur={() => write(text)}
              onKeyDown={(event) => { if (event.key === 'Enter') write(text) }}
              aria-label={`${kind}.${key}`}
            />
          </label>
          {error && <p className="ede__error" role="alert">{error}</p>}

          <div className="ede__consumers">
            <span className="ede__title">Follows {fn}({key}) in the theme</span>
            {consumers.length > 0
              ? <ul className="ede__list">{consumers.map((path) => <li key={path}><code>{path}</code></li>)}</ul>
              : <span className="ede__note">No theme value names it.</span>}
            <span className="ede__note">
              So does every stylesheet that writes <code>{kind === 'borders' ? 'border' : 'border-radius'}: {fn}({key})</code>
              {kind === 'radii' && <>, and every <code>@ds-surface</code>, <code>@ds-button</code> or <code>@ds-input</code> with size {key}</>}.
              A token compiles to <code>var(--uxdsl__{fn}__{key})</code>, so an edit here is a value change: it applies live, no rebuild.
            </span>
          </div>
        </div>
      </div>
    </InteractiveDemoContainer>
  )
}
