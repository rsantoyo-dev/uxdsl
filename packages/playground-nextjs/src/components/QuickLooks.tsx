'use client'

import { useState } from 'react'
import { Minus, Plus, RotateCcw, Sparkles, Type } from 'lucide-react'
import { useTheme } from './ThemeContext'
import SavedThemes from './SavedThemes'
import { DIALS, HOME, TOP, dialById, dialLevel, dialStep, dialHint, LOOKS, lookById, lookPatch, lookIsOn, lookOffPatch } from '../lib/quick-looks'
import { FONT_GROUPS, FONT_PRESETS, fontPresetPatch, presetOf } from '../lib/typography-editing'
import { checkPatch } from '../lib/theme-patch'
import { themes } from '../../themes'

/**
 * The Live theme handler's shortcuts, kept to one row and one line so the parts under them
 * are reached at once (src/lib/quick-looks.js). Five dials, Round, Space, Text, Border and
 * Shadow, step a whole family of the theme from 0 to 5 with − and +; the font of the page
 * (fonts.families.ui) is one choice in a list, with the presets the Typography part offers;
 * the brands are one click each. They all combine. The level a dial shows, the font named
 * and the brand that is pressed are read from the theme on the page, not remembered: an edit
 * in a part, another theme or "Start over" shows here at once, and a dial whose family was
 * edited by hand steps from those values. Level 2, what
 * taking a brand off gives back and where "Start over" goes is the named theme the theme on
 * the page was started from (Green stays green; a saved theme remembers its own). Each step
 * goes through applyTheme like any edit in the parts; the parts below then count the values
 * it moved, and the download bar takes the result to a project. Under the status line,
 * SavedThemes lists the themes these edits were saved as.
 */
export default function QuickLooks() {
  const { activeThemeData, currentTheme, setCustomTheme, customThemeName, customThemeOrigin: origin, savedThemeId, switchTheme } = useTheme()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // What a step said holds while its theme is on the page. A named theme chosen in the
  // header, or another saved theme opened, starts again; a step's own first save (a named
  // theme becoming a saved one) does not.
  const [seen, setSeen] = useState({ theme: currentTheme, saved: savedThemeId })
  if (seen.theme !== currentTheme || seen.saved !== savedThemeId) {
    setSeen({ theme: currentTheme, saved: savedThemeId })
    if (currentTheme !== 'custom' || (seen.saved !== null && savedThemeId !== null)) {
      setMessage(null)
      setError(null)
    }
  }
  const startTheme = themes[origin]

  /** Checked first, so a refusal is said here instead of the page staying as it was in silence. */
  const apply = (patch: Record<string, unknown>, said: string) => {
    const checked = checkPatch(activeThemeData, patch)
    if (!checked.ok) {
      setError(checked.message ?? 'The theme refused this change.')
      return
    }
    try {
      setCustomTheme(customThemeName || 'Custom Theme', patch)
      setMessage(said)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const step = (id: string, direction: -1 | 1) => {
    const dial = dialById(id)
    const next = dial && activeThemeData ? dialStep(dial, activeThemeData, startTheme, direction) : null
    if (dial && next) apply(next.patch, dialHint(dial, next.level, direction))
  }

  const isOn = (id: string) => {
    const look = lookById(id)
    return Boolean(look && activeThemeData && lookIsOn(look, activeThemeData, startTheme))
  }
  const toggle = (id: string) => {
    const look = lookById(id)
    if (!look) return
    const on = isOn(id)
    apply(
      on ? lookOffPatch(look, startTheme) : lookPatch(look, startTheme),
      on ? `${look.label} is off: the tokens it set are back to the values of the theme you started from.` : look.hint,
    )
  }

  const stack = String((activeThemeData?.fonts as { families?: Record<string, string> } | undefined)?.families?.ui ?? '')
  const font = presetOf(stack)
  const chooseFont = (name: string) => {
    const preset = FONT_PRESETS.find((candidate) => candidate.name === name)
    if (!preset || !activeThemeData) return
    apply(
      fontPresetPatch(activeThemeData.fonts, 'ui', preset),
      `Font: ${preset.name}. fonts.families.ui is now ${preset.stack}, and fonts.google loads it: every text role that uses the ui font follows.`,
    )
  }

  const startOver = () => {
    switchTheme(origin)
    setMessage(null)
    setError(null)
  }

  return (
    <section id="looks" className="qlk" aria-label="Quick looks">
      <div className="qlk__looks">
        <strong className="qlk__title">
          <Sparkles size={16} className="qlk__icon" aria-hidden="true" />
          One click, the whole page
        </strong>
        {DIALS.map((dial) => {
          const level = activeThemeData ? dialLevel(dial, activeThemeData, startTheme) : HOME
          const can = (direction: -1 | 1) => Boolean(activeThemeData && dialStep(dial, activeThemeData, startTheme, direction))
          const value = level === null ? 'edited by hand' : `${level} of ${TOP}`
          return (
            <div key={dial.id} className={`qlk__dial${level === HOME ? '' : ' is-moved'}`} role="group" aria-label={`${dial.label}: ${value}`} data-dial={dial.id}>
              <span className="qlk__dial-label">{dial.label}</span>
              <button type="button" className="qlk__dial-step" aria-label={dial.less} title={dial.less} disabled={!can(-1)} onClick={() => step(dial.id, -1)}>
                <Minus size={14} aria-hidden="true" />
              </button>
              <span className="qlk__dial-value" title={level === null ? 'Edited by hand: − and + step from the values on the page.' : `${value}; ${HOME} is the theme you started from.`}>
                {level ?? '•'}
              </span>
              <button type="button" className="qlk__dial-step" aria-label={dial.more} title={dial.more} disabled={!can(1)} onClick={() => step(dial.id, 1)}>
                <Plus size={14} aria-hidden="true" />
              </button>
            </div>
          )
        })}
        <label className={`qlk__font${stack === (startTheme.fonts as { families?: Record<string, string> } | undefined)?.families?.ui ? '' : ' is-moved'}`}>
          <Type size={14} aria-hidden="true" />
          <span className="qlk__dial-label">Font</span>
          <select className="qlk__font-select" value={font?.name ?? ''} onChange={(event) => chooseFont(event.target.value)} aria-label="Font of the page (fonts.families.ui)">
            {!font && <option value="">{stack || 'as written'}</option>}
            {FONT_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.presets.map((preset) => <option key={preset.name} value={preset.name}>{preset.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
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
          <RotateCcw size={12} aria-hidden="true" /> Start over
        </button>
      </div>
      <p className={`qlk__status${error ? ' is-invalid' : ''}`} role="status">
        {error ?? (currentTheme === 'custom' ? message : null) ?? `Each dial steps one family of the theme from 0 to ${TOP}, a little at a time, and the whole site follows: ${HOME} is the theme you started from. They combine with the font and a brand.`}
      </p>
      <SavedThemes />
    </section>
  )
}
