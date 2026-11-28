'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTheme } from './ThemeContext'
import { InteractiveDemoContainer } from './InteractiveDemoContainer'
import ColorCollection, { ColorFill } from './ColorCollection'
import { toHex6, PICKER_FALLBACK } from '../lib/palette-editing'
import { colorValue, colorPatch, colorConsumers, followerCount } from '../lib/color-editing'
import UsageExample, { jsonBlock, Result } from './UsageExample'
import { colorsUsage } from '../lib/usage-snippets'

/** Any CSS color as #rrggbb for the native picker, drawn through a canvas; null if it cannot be drawn. */
function pickerHex(value: string): string | null {
  const hex = toHex6(value)
  if (hex) return hex
  if (typeof document === 'undefined' || !CSS.supports('color', value)) return null
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.fillStyle = value
  context.fillRect(0, 0, 1, 1)
  const data = context.getImageData(0, 0, 1, 1).data
  return `#${[data[0], data[1], data[2]].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

const FAMILY_LABEL: Record<string, string> = {
  borders: 'Borders',
  shadows: 'Shadows',
  surfaces: 'Surfaces',
  buttons: 'Buttons',
  inputs: 'Inputs',
  typography_details: 'Typography',
}

type Follower = { role: string; via: string | null }

/**
 * Edits the color collection of the active theme (`colors`): pick a shade, change its value,
 * and see what follows it. A Palette role that says color(gray.900) changes with it, in the
 * mode where it says so, and so does every role linked to that one with palette(…). Changes go
 * through setCustomTheme → applyTheme like every part, so the Palette editor below and the JSON
 * part show them too.
 */
export default function ColorsEditor({ defaultKey = 'purple.700' }: { defaultKey?: string }) {
  const { activeThemeData, setCustomTheme, customThemeName, isDark } = useTheme()
  const colors = activeThemeData?.colors
  const [key, setKey] = useState(defaultKey)
  const value: string = colorValue(colors, key) ?? ''
  const [text, setText] = useState(value)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setText(value); setError(null) }, [value])

  // A theme without the chosen shade (another theme, a JSON edit): start from its first one.
  useEffect(() => {
    if (!colors || colorValue(colors, key) !== undefined) return
    const [first] = Object.entries(colors)
    if (first) setKey(typeof first[1] === 'string' ? first[0] : `${first[0]}.${Object.keys(first[1] as object)[0]}`)
  }, [colors, key])

  const found = useMemo(() => colorConsumers(activeThemeData, key), [activeThemeData, key])
  const hex = useMemo(() => pickerHex(value), [value])
  const usage = useMemo(() => colorsUsage(activeThemeData, key), [activeThemeData, key])

  const write = (next: string) => {
    const color = next.trim()
    if (!color || color === value) return
    if (typeof CSS !== 'undefined' && !CSS.supports('color', color)) {
      setError(`"${color}" is not a CSS color. Write a hex value, rgb(…), hsl(…) or oklch(…).`)
      return
    }
    try {
      setCustomTheme(customThemeName || 'Custom Theme', colorPatch(key, color))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const modes: Array<{ id: 'light' | 'dark'; label: string; list: Follower[] }> = [
    { id: 'light', label: 'Light mode', list: found.light },
    { id: 'dark', label: 'Dark mode', list: found.dark },
  ]
  const others = Object.entries(found.other) as Array<[string, string[]]>

  return (
    <InteractiveDemoContainer
      title="Colors"
      toolbar={
        <span className="cle__hint">
          The collection the Palette draws from. Roles name a shade with <code>color(family.shade)</code>, so changing a shade
          changes every role that names it, and every role linked to those.
        </span>
      }
    >
      <div className="cle">
        <ColorCollection colors={colors} selectedKey={key} onPick={setKey} label="Shade to edit" full />

        <div className="cle__editor">
          <div className="cle__written">
            <code>colors.{key}</code> = <code>{JSON.stringify(value)}</code>
          </div>
          <div className="cle__inputs">
            <input
              type="color"
              className="cle__picker"
              value={hex || PICKER_FALLBACK}
              onChange={(event) => { setText(event.target.value); write(event.target.value) }}
              aria-label={`Pick colors.${key}`}
            />
            <label className="cle__field">
              <span>Value</span>
              <input
                type="text"
                className="cle__text"
                value={text}
                spellCheck={false}
                onChange={(event) => setText(event.target.value)}
                onBlur={() => write(text)}
                onKeyDown={(event) => { if (event.key === 'Enter') write(text) }}
                aria-label={`colors.${key}`}
              />
            </label>
          </div>
          {error && <p className="cle__error" role="alert">{error}</p>}

          <div className="cle__followers">
            <span className="cle__title">
              {followerCount(found)
                ? <>Moves with <code>color({key})</code>:</>
                : <>Nothing in the theme names <code>color({key})</code>.</>}
            </span>
            {modes.map((mode) => mode.list.length > 0 && (
              <div key={mode.id} className="cle__group">
                <span className="cle__group-name">
                  {mode.label}
                  {(mode.id === 'dark') === Boolean(isDark) && <span className="cle__now"> · showing now</span>}
                </span>
                <ul className="cle__list">
                  {mode.list.map((item) => (
                    <li key={item.role} className="cle__item">
                      <code>palette({item.role})</code>
                      {item.via && <span className="cle__via">through {item.via}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {others.map(([family, paths]) => (
              <div key={family} className="cle__group">
                <span className="cle__group-name">{FAMILY_LABEL[family] ?? family}</span>
                <ul className="cle__list">
                  {paths.map((path) => <li key={path} className="cle__item"><code>{family}.{path}</code></li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
      <UsageExample
        subject="Colors"
        note={<>Use <code>color()</code> where the color itself is the point: a swatch, a scrim, a chart series. For the parts of an interface (actions, text, surfaces) name a Palette role (below), so a theme can recolor them.</>}
        blocks={[{ label: 'In a stylesheet (.uxdsl)', code: usage.stylesheet }, jsonBlock(usage.excerpt)]}
      >
        {/* The two declarations as the engine compiles them, so the boxes follow any shade, added ones included. */}
        <Result label=".swatch"><ColorFill colorKey={key} className="usx-box" aria-hidden="true" /></Result>
        <Result label=".scrim"><ColorFill colorKey={key} alpha={0.5} className="usx-box" aria-hidden="true" /></Result>
      </UsageExample>
    </InteractiveDemoContainer>
  )
}
