'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from './ThemeContext'
import UsageExample, { jsonBlock, Result } from './UsageExample'
import { paletteUsage } from '../lib/usage-snippets'
import { InteractiveDemoContainer } from './InteractiveDemoContainer'
import ColorCollection from './ColorCollection'
import {
  classifyValue,
  paletteFor,
  isInherited,
  roleGroups,
  groupRoles,
  wouldCycle,
  patchFor,
  pathFor,
  contrastRatio,
  toHex6,
  PICKER_FALLBACK,
} from '../lib/palette-editing'

// A Palette variant's color comes from a class PaletteFamilyEditor.uxdsl generates for every
// family and variant of the theme: .pfe-fill--primary-main { background: palette(primary.main) }.
// The theme's Button `selected` state matches .is-selected; a radio's aria-checked does not.
const selected = (on: boolean) => (on ? ' is-selected' : '')
const fill = (key: string) => `pfe-fill--${key.replace('.', '-')}`
const ink = (key: string) => `pfe-ink--${key.replace('.', '-')}`

type Mode = 'light' | 'dark'
type Source = 'collection' | 'role' | 'free'

const SOURCES: Array<{ id: Source; label: string; hint: string }> = [
  { id: 'collection', label: 'Color collection', hint: 'Writes color(family.shade): the variant follows that shade of the theme’s colors.' },
  { id: 'role', label: 'Link to a role', hint: 'Writes palette(family.variant): the variant follows that role, in each mode.' },
  { id: 'free', label: 'Free color', hint: 'Writes the color itself. It tracks no token.' },
]

/** The rendered color of an element as [r, g, b], read through a canvas so any CSS color space works. */
function renderedRgb(element: HTMLElement | null, property: 'backgroundColor' | 'color'): [number, number, number] | null {
  if (!element) return null
  const css = getComputedStyle(element)[property]
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.fillStyle = css
  context.fillRect(0, 0, 1, 1)
  const data = context.getImageData(0, 0, 1, 1).data
  return data[3] === 0 ? null : [data[0], data[1], data[2]]
}

/**
 * Edits the Palette of the active theme: pick a role (primary, secondary, surface…), then
 * each of its variants, in light or dark mode.
 * Every change goes through `setCustomTheme`, the same path as the JSON editor, so the
 * two stay in step and the runtime (`applyTheme`) validates each one.
 */
export default function PaletteFamilyEditor({ defaultFamily = 'primary' }: { defaultFamily?: string }) {
  const { activeThemeData, setCustomTheme, customThemeName, isDark, toggleDarkMode } = useTheme()
  const mode: Mode = isDark ? 'dark' : 'light'
  const palette = useMemo(() => paletteFor(activeThemeData, mode), [activeThemeData, mode])
  // The roles are the families of the active theme's palette, in its order.
  const families = useMemo(() => groupRoles(roleGroups(activeThemeData?.palette)), [activeThemeData])
  const [family, setFamily] = useState(defaultFamily)
  const variants = useMemo(() => Object.keys(activeThemeData?.palette?.[family] || {}), [activeThemeData, family])
  const [variant, setVariant] = useState(() => variants[0] || 'main')
  const chooseFamily = (next: string) => {
    setFamily(next)
    setVariant(Object.keys(activeThemeData?.palette?.[next] || {})[0] || 'main')
  }
  // main with contrast text is the role's sample; text, divider and action have no such pair.
  const hasPair = variants.includes('main') && variants.includes('contrast')
  const current: string = palette?.[family]?.[variant] ?? ''
  const classified = classifyValue(current)
  const [source, setSource] = useState<Source>(classified.source)
  const [error, setError] = useState<string | null>(null)
  const [freeText, setFreeText] = useState(current)
  const [ratio, setRatio] = useState<number | null>(null)
  const [renderedHex, setRenderedHex] = useState<string | null>(null)
  const sampleRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLSpanElement>(null)
  const edited = `${family}.${variant}`

  // Selecting another variant, or a change from elsewhere (the JSON tab, another theme),
  // shows the source that value is written with.
  useEffect(() => {
    setSource(classifyValue(current).source)
    setFreeText(current)
    setError(null)
  }, [current, variant, mode])

  // The contrast of `contrast` text on `main`, as the browser renders it now.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const background = renderedRgb(sampleRef.current, 'backgroundColor')
      const text = renderedRgb(sampleRef.current, 'color')
      setRatio(background && text ? contrastRatio(background, text) : null)
      // The picker starts from the color the variant shows now, whatever it is written as.
      const shown = renderedRgb(currentRef.current, 'backgroundColor')
      setRenderedHex(shown ? `#${shown.map((c) => c.toString(16).padStart(2, '0')).join('')}` : null)
    })
    return () => cancelAnimationFrame(frame)
  }, [activeThemeData, mode, family, variant])

  const write = (value: string) => {
    try {
      setCustomTheme(customThemeName || 'Custom Theme', patchFor(mode, family, variant, value))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const applyFreeText = () => {
    const value = freeText.trim()
    if (!value || value === current) return
    if (typeof CSS !== 'undefined' && !CSS.supports('color', value)) {
      setError(`"${value}" is not a CSS color.`)
      return
    }
    write(value)
  }

  const setMode = (next: Mode) => {
    if (next !== mode) toggleDarkMode()
  }

  const groups = useMemo(() => roleGroups(palette), [palette])
  const inherited = mode === 'dark' && isInherited(activeThemeData, family, variant)

  const usage = useMemo(() => paletteUsage(activeThemeData, family), [activeThemeData, family])
  return (
    <InteractiveDemoContainer
      title="Palette"
      toolbar={
        <div className="pfe__toolbar">
          <div className="pfe__segmented" role="radiogroup" aria-label="Mode to edit">
            {(['light', 'dark'] as Mode[]).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} className={`pfe__segment${selected(mode === m)}`} onClick={() => setMode(m)}>
                {m === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
          <span className="pfe__hint">The site switches with it, so you see what you edit.</span>
        </div>
      }
    >
      <div className="pfe">
        <div className="pfe__families" role="radiogroup" aria-label="Role">
          {families.map((group: { label: string; roles: Array<{ family: string; keys: string[] }> }) => (
            <div key={group.label} className="pfe__group">
              <span className="pfe__group-label">{group.label}</span>
              <div className="pfe__group-roles">
                {group.roles.map((role) => {
                  const has = (variant: string) => role.keys.includes(`${role.family}.${variant}`)
                  // The face: main with "Aa" in contrast; text on the canvas; otherwise the first variant.
                  const faceKey = role.family === 'text' || !has('main') ? role.keys[0] : `${role.family}.main`
                  const face = role.family === 'text'
                    ? `pfe-fill--surface-main ${ink(faceKey)}`
                    : `${fill(faceKey)} ${has('contrast') ? ink(`${role.family}.contrast`) : ''}`
                  // The band shows the variants the face does not: light and dark, paper and subtle…
                  const bands = role.keys.filter((key) => key !== faceKey && key !== `${role.family}.contrast`)
                  return (
                    <button
                      key={role.family}
                      type="button"
                      role="radio"
                      aria-checked={family === role.family}
                      className={`pfe__role${selected(family === role.family)}`}
                      onClick={() => chooseFamily(role.family)}
                    >
                      <span className={`pfe__role-face ${face}`}>{role.family === 'text' || has('contrast') ? 'Aa' : ''}</span>
                      <span className="pfe__role-strip" aria-hidden="true">
                        {bands.map((key) => <span key={key} className={`pfe__role-band ${fill(key)}`} />)}
                      </span>
                      <span className="pfe__role-name">{role.family}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="pfe__variants" role="radiogroup" aria-label={`Variant of ${family}`}>
          {variants.map((name) => {
            const value: string = palette?.[family]?.[name] ?? ''
            return (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={variant === name}
                className={`pfe__variant${selected(variant === name)}`}
                onClick={() => setVariant(name)}
              >
                <span className={`pfe__swatch ${fill(`${family}.${name}`)}`} />
                <span className="pfe__variant-name">{name}</span>
                <code className="pfe__variant-value">{value}</code>
                {mode === 'dark' && isInherited(activeThemeData, family, name) && <span className="pfe__badge">light value</span>}
              </button>
            )
          })}
        </div>

        <div className="pfe__editor">
          <span ref={currentRef} className={`pfe__probe ${fill(edited)}`} aria-hidden="true" />
          <div className="pfe__written">
            <code>{pathFor(mode, family, variant)}</code> = <code>{JSON.stringify(current)}</code>
            {inherited && <span className="pfe__note"> (not written for dark: the light value applies)</span>}
          </div>

          <div className="pfe__segmented" role="radiogroup" aria-label="Where the color comes from">
            {SOURCES.map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={source === s.id} className={`pfe__segment${selected(source === s.id)}`} onClick={() => setSource(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
          <p className="pfe__hint">{SOURCES.find((s) => s.id === source)?.hint}</p>

          {source === 'collection' && (
            <ColorCollection
              colors={activeThemeData?.colors}
              selectedKey={classified.source === 'collection' ? classified.key : null}
              onPick={(key) => write(`color(${key})`)}
              label="Color collection"
            />
          )}

          {source === 'role' && (
            <label className="pfe__field">
              <span>Role</span>
              <select
                className="pfe__select"
                value={classified.source === 'role' ? classified.key ?? '' : ''}
                onChange={(event) => event.target.value && write(`palette(${event.target.value})`)}
              >
                <option value="">Choose a role…</option>
                {groups.map((group: { family: string; keys: string[] }) => (
                  <optgroup key={group.family} label={group.family}>
                    {group.keys.map((key) => {
                      const cyclic = wouldCycle(palette, edited, key)
                      return (
                        <option key={key} value={key} disabled={cyclic}>
                          {key}{key === edited ? ' (this variant)' : cyclic ? ' (would link back here)' : ''}
                        </option>
                      )
                    })}
                  </optgroup>
                ))}
              </select>
            </label>
          )}

          {source === 'free' && (
            <div className="pfe__free">
              <input
                type="color"
                aria-label="Pick a color"
                className="pfe__picker"
                value={toHex6(current) || renderedHex || PICKER_FALLBACK}
                onChange={(event) => { setFreeText(event.target.value); write(event.target.value) }}
              />
              <input
                type="text"
                aria-label="Any CSS color"
                className="pfe__text"
                value={freeText}
                spellCheck={false}
                onChange={(event) => setFreeText(event.target.value)}
                onBlur={applyFreeText}
                onKeyDown={(event) => { if (event.key === 'Enter') applyFreeText() }}
                placeholder="Any CSS color: hex, rgb(), oklch()…"
              />
              <button type="button" className="pfe__apply" onClick={applyFreeText}>Apply</button>
            </div>
          )}

          {error && <p className="pfe__error" role="alert">{error}</p>}
        </div>

        {hasPair ? (
          <div className="pfe__preview">
            <div ref={sampleRef} className={`pfe__sample ${fill(`${family}.main`)} ${ink(`${family}.contrast`)}`}>
              Aa {family}
            </div>
            {variants.filter((name) => name !== 'main' && name !== 'contrast').map((name) => (
              <div key={name} className={`pfe__sample pfe__sample--small ${fill(`${family}.${name}`)} ${ink(`${family}.contrast`)}`}>
                {name}
              </div>
            ))}
            <p className="pfe__ratio">
              contrast on main:{' '}
              {ratio === null ? '—' : <strong>{ratio.toFixed(2)}:1 {ratio >= 4.5 ? '(AA)' : ratio >= 3 ? '(AA large text only)' : '(below AA)'}</strong>}
            </p>
          </div>
        ) : (
          <div className="pfe__preview pfe-fill--surface-main">
            {variants.map((name) => (
              <span key={name} className={`pfe__sample pfe__sample--small ${family === 'text' ? ink(`${family}.${name}`) : fill(`${family}.${name}`)}`}>
                {family === 'text' ? `Aa ${name}` : name}
              </span>
            ))}
          </div>
        )}
      </div>
      <UsageExample
        subject="Palette"
        note={<>Components name the role, never the color, so a theme with another <code>{family}</code> recolors them without a rebuild. The dark-mode values live under <code>modes.dark.palette</code>.</>}
        blocks={[{ label: 'In a stylesheet (.uxdsl)', code: usage.stylesheet }, jsonBlock(usage.excerpt)]}
      >
        {hasPair ? (
          <>
            <Result label=".cta"><span className={`usx-box ${fill(`${family}.main`)} ${ink(`${family}.contrast`)}`}>Call to action</span></Result>
            {variants.includes('dark') && <Result label=".cta:hover"><span className={`usx-box ${fill(`${family}.dark`)} ${ink(`${family}.contrast`)}`}>Call to action</span></Result>}
            <Result label=".badge"><span className={`usx-box pfe-tint--${family} ${ink(`${family}.main`)}`}>New</span></Result>
          </>
        ) : family === 'text' ? (
          <Result label=".muted"><span className={`usx-box usx-box--card ${ink(`text.${variants.includes('secondary') ? 'secondary' : variants[0]}`)}`}>Secondary text</span></Result>
        ) : (
          <Result label=".rule"><span className={`usx-box usx-box--line ${fill(`${family}.${variants[0]}`)}`} aria-hidden="true" /></Result>
        )}
      </UsageExample>
    </InteractiveDemoContainer>
  )
}
