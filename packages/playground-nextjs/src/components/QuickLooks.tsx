'use client'

import { useState } from 'react'
import { RotateCcw, Sparkles } from 'lucide-react'
import { useTheme, type ThemeName } from './ThemeContext'
import { LOOKS, lookById, lookPatch, lookIsOn, lookOffPatch } from '../lib/quick-looks'
import { checkPatch } from '../lib/theme-patch'
import { themes } from '../../themes'

type NamedTheme = Exclude<ThemeName, 'custom'>

/**
 * The Live theme handler's first move: one click, one theme patch, and the whole page changes
 * (src/lib/quick-looks.js). Looks of different kinds compose, two of one kind replace each
 * other, and a second click takes a look off. Which ones are pressed is read from the theme
 * on the page, not remembered: an edit in a tab, another theme or "Start over" shows here at
 * once. What a look is measured against, what taking it off gives back and where "Start over"
 * goes is the named theme the page had before the first edit (Green stays green). Each goes
 * through applyTheme like any edit in the tabs; the tabs below then show the tokens each look
 * moved, and the download bar takes the result to a project.
 */
export default function QuickLooks() {
  const { activeThemeData, currentTheme, setCustomTheme, customThemeName, switchTheme } = useTheme()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The last named theme shown: an edit makes the theme "custom", which keeps this one.
  const [origin, setOrigin] = useState<NamedTheme>('default')
  if (currentTheme !== 'custom' && currentTheme !== origin) {
    setOrigin(currentTheme)
    setError(null)
  }
  const startTheme = themes[origin]
  const isOn = (id: string) => {
    const look = lookById(id)
    return Boolean(look && activeThemeData && lookIsOn(look, activeThemeData, startTheme))
  }

  const toggle = (id: string) => {
    const look = lookById(id)
    if (!look) return
    const on = isOn(id)
    const patch = on ? lookOffPatch(look, startTheme) : lookPatch(look, startTheme)
    const checked = checkPatch(activeThemeData, patch)
    if (!checked.ok) {
      setError(checked.message ?? 'The theme refused this look.')
      return
    }
    try {
      setCustomTheme(customThemeName || 'Custom Theme', patch)
      setMessage(on ? `${look.label} is off: the tokens it set are back to the values of the theme you started from.` : look.hint)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const startOver = () => {
    switchTheme(origin)
    setMessage(null)
    setError(null)
  }

  return (
    <section className="qlk" aria-label="Quick looks">
      <div className="qlk__head">
        <Sparkles size={16} aria-hidden="true" />
        <strong className="qlk__title">One click, the whole page</strong>
        <span className="qlk__hint">Each look is a theme patch: the showcase, the docs and every tab below follow it at once.</span>
      </div>
      <div className="qlk__looks">
        {LOOKS.map((look) => {
          const on = isOn(look.id)
          return (
            <button
              key={look.id}
              type="button"
              className={`qlk__look${on ? ' is-selected' : ''}`}
              aria-pressed={on}
              title={look.hint}
              onClick={() => toggle(look.id)}
            >
              {look.label}
            </button>
          )
        })}
        <button type="button" className="qlk__reset" onClick={startOver}>
          <RotateCcw size={14} aria-hidden="true" /> Start over
        </button>
      </div>
      <p className={`qlk__status${error ? ' is-invalid' : ''}`} role="status">
        {/* What a look said holds while its theme is on the page: a named theme chosen in the header starts again. */}
        {error ?? (currentTheme === 'custom' ? message : null) ?? 'Combine them: Rounder, then Ocean brand, then Compact. Press a look again to take it off, then open a tab to see the tokens it moved.'}
      </p>
    </section>
  )
}
