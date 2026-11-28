'use client'

import { Save, X } from 'lucide-react'
import { useTheme } from './ThemeContext'

const STARTED_FROM = { default: 'Default', green: 'Green', purple: 'Purple', slate: 'Slate' } as const

/**
 * The themes this visitor made, under the quick looks. Nothing here is pressed to save: every
 * edit on the site is saved as it lands (ThemeContext, src/lib/saved-themes.js). An edit on
 * Default, Green or Slate starts a new saved theme; an edit on a saved theme updates it. So
 * switching theme in the header never loses work, and each saved theme is one click away
 * here. They are kept in this browser only; the download bar is what takes one to a project.
 */
export default function SavedThemes() {
  const { savedThemes, savedThemeId, openSavedTheme, removeSavedTheme } = useTheme()

  return (
    <div className="svt" role="group" aria-label="Saved themes">
      <span className="svt__title">
        <Save size={14} className="svt__icon" aria-hidden="true" />
        Saved as you edit
      </span>
      {savedThemes.map((theme) => {
        const on = theme.id === savedThemeId
        return (
          <span key={theme.id} className={`svt__theme${on ? ' is-selected' : ''}`}>
            <button
              type="button"
              className="svt__open"
              aria-pressed={on}
              title={on ? `${theme.name} is on the page: every edit is saved to it.` : `Back to ${theme.name}, started from ${STARTED_FROM[theme.origin]}.`}
              onClick={() => { if (!on) openSavedTheme(theme.id) }}
            >
              {theme.name}
            </button>
            <button type="button" className="svt__remove" aria-label={`Remove ${theme.name}`} title={`Remove ${theme.name}`} onClick={() => removeSavedTheme(theme.id)}>
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        )
      })}
      <span className="svt__note">
        {savedThemes.length === 0
          ? 'Nothing yet. Your first change starts “My theme 1”, kept in this browser: switch theme and come back to it.'
          : savedThemeId
            ? 'Kept in this browser. To start another, go back to a site theme (Start over, or a color in the header) and change something.'
            : 'Kept in this browser. A change now starts a new one; a saved theme opens with one click.'}
      </span>
    </div>
  )
}
