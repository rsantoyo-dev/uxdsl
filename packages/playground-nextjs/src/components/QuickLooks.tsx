'use client'

import { useState } from 'react'
import { RotateCcw, Sparkles } from 'lucide-react'
import { useTheme } from './ThemeContext'
import { LOOKS, lookById } from '../lib/quick-looks'
import { checkPatch } from '../lib/theme-patch'

/**
 * The Live theme handler's first move: one click, one theme patch, and the whole page changes
 * (src/lib/quick-looks.js). Looks compose, each goes through applyTheme like any edit in the
 * tabs, and "Start over" goes back to this site's theme. The tabs below then show the tokens
 * each look moved, and the download bar takes the result to a project.
 */
export default function QuickLooks() {
  const { activeThemeData, setCustomTheme, customThemeName, switchTheme } = useTheme()
  const [applied, setApplied] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const apply = (id: string) => {
    const look = lookById(id)
    if (!look) return
    const patch = look.patch(activeThemeData)
    const checked = checkPatch(activeThemeData, patch)
    if (!checked.ok) {
      setError(checked.message ?? 'The theme refused this look.')
      return
    }
    try {
      setCustomTheme(customThemeName || 'Custom Theme', patch)
      setApplied((list) => [...list.filter((item) => item !== id), id])
      setMessage(look.hint)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const startOver = () => {
    switchTheme('default')
    setApplied([])
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
        {LOOKS.map((look) => (
          <button
            key={look.id}
            type="button"
            className={`qlk__look${applied.includes(look.id) ? ' is-selected' : ''}`}
            aria-pressed={applied.includes(look.id)}
            title={look.hint}
            onClick={() => apply(look.id)}
          >
            {look.label}
          </button>
        ))}
        <button type="button" className="qlk__reset" onClick={startOver}>
          <RotateCcw size={14} aria-hidden="true" /> Start over
        </button>
      </div>
      <p className={`qlk__status${error ? ' is-invalid' : ''}`} role="status">
        {error ?? message ?? 'Combine them: Rounder, then Ocean brand, then Compact. Then open a tab to see the tokens they moved.'}
      </p>
    </section>
  )
}
