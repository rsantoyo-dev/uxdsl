'use client'

import { useEffect, useMemo, useState } from 'react'
import { responsiveEntries, resolveResponsiveValue, inspectResponsiveValue } from 'uxdsl/language'
import { generateShadowCss, getShadowTokens } from 'uxdsl/engine'
import { useTheme } from './ThemeContext'
import { useBreakpoints } from './BreakpointsProvider'
import { InteractiveDemoContainer } from './InteractiveDemoContainer'
import { edgeKeys, edgeConsumers, borderColorOptions } from '../lib/edge-editing'
import { NEW_LAYER, parseLayer, buildShadow, layersOf, pxOf, shadowDefinition } from '../lib/shadow-editing'
import UsageExample, { jsonBlock, Result } from './UsageExample'
import { shadowUsage } from '../lib/usage-snippets'

type Layer = { inset: boolean; x: string; y: string; blur: string; spread: string; color: string }

// ShadowsEditor.uxdsl generates one class per token of the base theme, shadow(n), so every
// tile is the token itself and follows each edit. A key added in the JSON tab is listed, drawn plain.
const PREVIEW_KEYS = ['0', '1', '2', '3', '4', '5']
const tokenClass = (key: string) => (PREVIEW_KEYS.includes(key) ? `esh-shadow--${key}` : '')
const selected = (on: boolean) => (on ? ' is-selected' : '')
const LENGTHS: { part: 'x' | 'y' | 'blur' | 'spread'; label: string; min: number; max: number }[] = [
  { part: 'x', label: 'x', min: -40, max: 40 },
  { part: 'y', label: 'y', min: -40, max: 40 },
  { part: 'blur', label: 'blur', min: 0, max: 80 },
  { part: 'spread', label: 'spread', min: -20, max: 40 },
]
// Suggestions for a layer's color: translucent black and white, then the theme's own colors.
const ALPHA_SUGGESTIONS = ['color(black, 0.08)', 'color(black, 0.12)', 'color(black, 0.2)', 'color(black, 0.35)', 'color(white, 0.5)', 'palette(primary.main, 0.3)']

/** One layer: inset, its four lengths (a slider when it is in px) and its color. */
function LayerCard({ index, layer, listId, onChange, onRemove }: { index: number; layer: Layer; listId: string; onChange: (next: Layer) => void; onRemove: () => void }) {
  const [color, setColor] = useState(layer.color)
  useEffect(() => setColor(layer.color), [layer.color])
  return (
    <div className="esh__layer">
      <div className="esh__layer-head">
        <span className="esh__title">Layer {index + 1}</span>
        <label className="esh__check">
          <input type="checkbox" checked={layer.inset} onChange={(event) => onChange({ ...layer, inset: event.target.checked })} />
          inset
        </label>
        <button type="button" className="esh__remove" onClick={onRemove}>Remove</button>
      </div>
      {LENGTHS.map(({ part, label, min, max }) => {
        const px = pxOf(layer[part])
        return (
          <label key={part} className="esh__length">
            <code className="esh__part">{label}</code>
            {px === null ? (
              <input className="esh__text" value={layer[part]} spellCheck={false} onChange={(event) => onChange({ ...layer, [part]: event.target.value })} aria-label={`Layer ${index + 1} ${label}`} />
            ) : (
              <input type="range" className="esh__range" min={Math.min(min, px)} max={Math.max(max, px)} step={1} value={px}
                onChange={(event) => onChange({ ...layer, [part]: event.target.value === '0' ? '0' : `${event.target.value}px` })} aria-label={`Layer ${index + 1} ${label}`} />
            )}
            <span className="esh__value">{layer[part]}</span>
          </label>
        )
      })}
      <label className="esh__length">
        <code className="esh__part">color</code>
        <input className="esh__text esh__color" list={listId} value={color} spellCheck={false}
          onChange={(event) => setColor(event.target.value)}
          onBlur={() => color.trim() !== layer.color && onChange({ ...layer, color: color.trim() })}
          onKeyDown={(event) => { if (event.key === 'Enter' && color.trim() !== layer.color) onChange({ ...layer, color: color.trim() }) }}
          aria-label={`Layer ${index + 1} color`} />
      </label>
    </div>
  )
}

/**
 * Edits the Shadow tokens of the active theme (`shadows`). Every shadow(n) is drawn live, the
 * chosen one sits on a card, a button and a menu, and its layers can be changed at any
 * breakpoint: offsets, blur and spread with sliders, the color as a token or any CSS color,
 * inset, a layer added or removed. Changes go through setCustomTheme → applyTheme like every tab.
 */
export default function ShadowsEditor() {
  const { activeThemeData, setCustomTheme, customThemeName } = useTheme()
  const { breakpoints } = useBreakpoints()
  const tokens: Record<string, string> = useMemo(() => getShadowTokens(activeThemeData), [activeThemeData])
  const keys = useMemo(() => edgeKeys(tokens), [tokens])
  const [key, setKey] = useState('2')
  useEffect(() => { if (keys.length && !keys.includes(key)) setKey(keys[0]) }, [keys, key])
  const definition: string = tokens[key] ?? ''
  const order = useMemo(() => Object.keys(breakpoints).sort((a, b) => breakpoints[a] - breakpoints[b]), [breakpoints])
  const [bp, setBp] = useState(order[0] ?? 'xs')
  const consumers = useMemo(() => edgeConsumers(activeThemeData, 'shadow', key), [activeThemeData, key])
  const colorSuggestions = useMemo(() => [...ALPHA_SUGGESTIONS, ...borderColorOptions(activeThemeData).flatMap((group) => group.values)], [activeThemeData])

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

  const entries: Record<string, string> = useMemo(() => responsiveEntries(definition, breakpoints), [definition, breakpoints])
  const active = viewport === null || !definition ? null : inspectResponsiveValue(definition, viewport, breakpoints).active
  const written = entries[bp] ?? ''
  const shown = resolveResponsiveValue(definition, bp, breakpoints) ?? ''
  const layers = written ? layersOf(written) : null

  /** Writes the token; the Shadow engine compiles it first, so a value it cannot read is refused with its message. */
  const write = (next: string) => {
    const value = next.trim()
    if (!value) return setError('A shadow needs a value: none for no shadow.')
    if (value === definition) return
    try {
      generateShadowCss({ ...activeThemeData, shadows: { ...tokens, [key]: value } }, breakpoints)
      setCustomTheme(customThemeName || 'Custom Theme', { shadows: { [key]: value } })
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }
  const writeAt = (value: string) => write(shadowDefinition({ ...entries, [bp]: value }, order))
  const setLayers = (next: Layer[]) => writeAt(buildShadow(next))

  const usage = useMemo(() => shadowUsage(activeThemeData, key), [activeThemeData, key])
  return (
    <InteractiveDemoContainer
      title="Shadows"
      toolbar={
        <span className="esh__hint">
          Pick a token: every tile is <code>shadow(n)</code> itself, and the card, button and menu use <code>shadow({key})</code>.
        </span>
      }
    >
      <datalist id="esh-colors">
        {colorSuggestions.map((value) => <option key={value} value={value} />)}
      </datalist>
      <div className="esh">
        <div className="esh__preview">
          <div className="esh__gallery" role="radiogroup" aria-label="Shadow tokens">
            {keys.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={k === key} className={`esh__tile${selected(k === key)}`} onClick={() => setKey(k)}>
                <span className={`esh__box ${tokenClass(k)}`} aria-hidden="true" />
                <code className="esh__tile-name">shadow({k})</code>
              </button>
            ))}
          </div>

          <div className="esh__stage">
            <code className="esh__stage-label">shadow({key}) on real components · your window{active ? `: ${active}` : ''}</code>
            <div className="esh__samples">
              <div className={`esh__card esh-s--${key}`}>
                <span className="esh__card-title">@ds-surface(contained)</span>
                <span className="esh__card-text">then box-shadow: shadow({key});</span>
              </div>
              <button type="button" className={`esh__button esh-s--${key}`}>A button</button>
              <ul className={`esh__menu esh-s--${key}`} aria-label="A sample menu">
                <li>Rename</li>
                <li>Duplicate</li>
                <li>Delete</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="esh__editor">
          <code className="esh__written">shadows.{key}</code>
          <div className="esh__bps" role="radiogroup" aria-label="Breakpoint to edit">
            {order.map((name) => (
              <button key={name} type="button" role="radio" aria-checked={name === bp} className={`esh__bp${selected(name === bp)}${entries[name] ? ' is-written' : ''}`} onClick={() => setBp(name)}>
                {name}{active === name ? ' · your window' : ''}
              </button>
            ))}
          </div>
          <span className="esh__note">A breakpoint in bold says its own value; the others keep the one before them.</span>

          {!written ? (
            <div className="esh__kept">
              <span className="esh__note">From {bp}, shadow({key}) keeps <code>{shown || '—'}</code>.</span>
              <button type="button" className="esh__action" onClick={() => writeAt(shown && shown !== 'none' ? shown : NEW_LAYER)}>Change it from {bp}</button>
            </div>
          ) : layers === null ? (
            <span className="esh__note">This value is written in a form the layer editor does not read: edit the definition below.</span>
          ) : (
            <div className="esh__layers">
              {layers.length === 0 && <span className="esh__note">No shadow from {bp} (<code>none</code>).</span>}
              {layers.map((layer, index) => (
                <LayerCard key={index} index={index} layer={layer as Layer} listId="esh-colors"
                  onChange={(next) => setLayers(layers.map((l, i) => (i === index ? next : l)) as Layer[])}
                  onRemove={() => setLayers(layers.filter((_, i) => i !== index) as Layer[])} />
              ))}
              <div className="esh__actions">
                <button type="button" className="esh__action" onClick={() => setLayers([...(layers as Layer[]), parseLayer(NEW_LAYER) as Layer])}>Add a layer</button>
                {bp !== order[0] && (
                  <button type="button" className="esh__action" onClick={() => writeAt('')}>Keep the previous from {bp}</button>
                )}
              </div>
            </div>
          )}

          <label className="esh__definition">
            <span className="esh__title">The definition</span>
            <input type="text" className="esh__def" value={text} spellCheck={false}
              onChange={(event) => setText(event.target.value)}
              onBlur={() => write(text)}
              onKeyDown={(event) => { if (event.key === 'Enter') write(text) }}
              aria-label={`shadows.${key}`} />
          </label>
          {error && <p className="esh__error" role="alert">{error}</p>}

          <div className="esh__consumers">
            <span className="esh__title">Follows shadow({key}) in the theme</span>
            {consumers.length > 0
              ? <ul className="esh__list">{consumers.map((path) => <li key={path}><code>{path}</code></li>)}</ul>
              : <span className="esh__note">No theme value names it.</span>}
            <span className="esh__note">
              So does every stylesheet that writes <code>box-shadow: shadow({key})</code>. A token compiles to
              <code> var(--uxdsl__shadow__{key})</code>, so an edit here is a value change: it applies live, no rebuild.
            </span>
          </div>
        </div>
      </div>
      <UsageExample
        note={<>Layers, colors and breakpoints stay in the theme; the component only says which depth.</>}
        blocks={[{ label: 'In a stylesheet (.uxdsl)', code: usage.stylesheet }, jsonBlock(usage.excerpt)]}
      >
        {tokenClass(key) ? (
          <Result label=".card"><div className={`usx-box usx-box--card ${tokenClass(key)}`}>shadow({key})</div></Result>
        ) : (
          <p className="esh__hint">This token was added on this page: a rebuild compiles a class for its live box.</p>
        )}
      </UsageExample>
    </InteractiveDemoContainer>
  )
}
