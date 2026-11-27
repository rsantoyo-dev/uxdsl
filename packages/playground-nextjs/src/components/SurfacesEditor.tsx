'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSurfaceTokens, getButtonTokens, getInputTokens, SURFACE_PROPERTIES } from 'uxdsl/engine'
import { useTheme } from './ThemeContext'
import { InteractiveDemoContainer } from './InteractiveDemoContainer'
import RoleField from './RoleField'
import { suggestions, rolePatch, surfaceUsers } from '../lib/role-editing'
import { checkPatch } from '../lib/theme-patch'
import UsageExample, { jsonBlock, Result } from './UsageExample'
import { surfaceUsage } from '../lib/usage-snippets'

// SurfacesEditor.uxdsl generates a class per role of the base theme and per tone, each one
// @ds-surface(role tone) itself. A role added in the JSON tab has no compiled rule yet: it
// is listed and editable, and a rebuild draws it.
export const SURFACE_ROLES = ['contained', 'outlined', 'flat']
export const TONES = ['primary', 'secondary', 'tertiary', 'success', 'info', 'warning', 'error', 'neutral', 'dark', 'light', 'surface']
const CANVAS_TONES = ['surface', 'light', 'dark']
const selected = (on: boolean) => (on ? ' is-selected' : '')
const surfaceClass = (role: string, tone: string) => (SURFACE_ROLES.includes(role) ? `esf-s--${role}${tone ? `-${tone}` : ''}` : '')

/**
 * Edits the Surface roles of the active theme (`surfaces`): the six fields a container role
 * composes from the other tokens, padding from Density, corners from Radii, colors from the
 * Palette, edge from Borders, depth from Shadows. Every role is drawn live with the tone
 * chosen above, and the Buttons and Inputs built on the chosen one are listed: they follow
 * it too. Changes go through setCustomTheme → applyTheme like every tab.
 */
export default function SurfacesEditor() {
  const { activeThemeData, setCustomTheme, customThemeName } = useTheme()
  const tokens: Record<string, Record<string, string>> = useMemo(() => getSurfaceTokens(activeThemeData), [activeThemeData])
  const roles = useMemo(() => Object.keys(tokens), [tokens])
  const [role, setRole] = useState('contained')
  const [tone, setTone] = useState('')
  useEffect(() => { if (roles.length && !roles.includes(role)) setRole(roles[0]) }, [roles, role])
  const tones = useMemo(() => TONES.filter((t) => activeThemeData?.palette?.[t]), [activeThemeData])
  const users = useMemo(() => surfaceUsers(getButtonTokens(activeThemeData), getInputTokens(activeThemeData), role), [activeThemeData, role])

  const write = (field: string, value: string): string | null => {
    const patch = rolePatch('surfaces', role, field, value)
    const checked = checkPatch(activeThemeData, patch)
    if (!checked.ok) return checked.message ?? 'The theme refused this value.'
    try {
      setCustomTheme(customThemeName || 'Custom Theme', patch)
      return null
    } catch (cause) {
      return cause instanceof Error ? cause.message : String(cause)
    }
  }

  const usage = useMemo(() => surfaceUsage(activeThemeData, role, tone), [activeThemeData, role, tone])
  return (
    <InteractiveDemoContainer
      title="Surfaces"
      toolbar={
        <div className="esf__toolbar">
          <div className="esf__chips" role="radiogroup" aria-label="Surface role">
            {roles.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={r === role} className={`esf__chip${selected(r === role)}`} onClick={() => setRole(r)}>{r}</button>
            ))}
          </div>
          <label className="esf__tone">
            <span className="esf__hint">Tone</span>
            <select className="esf__select" value={tone} onChange={(event) => setTone(event.target.value)} aria-label="Tone of the preview">
              <option value="">none (the role’s own colors)</option>
              {tones.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>
      }
    >
      <div className="esf">
        <div className="esf__preview">
          <div className="esf__grid" role="radiogroup" aria-label="Surface roles, live">
            {roles.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={r === role} className={`esf__card ${surfaceClass(r, tone)}${selected(r === role)}`} onClick={() => setRole(r)}>
                <code className="esf__card-title">@ds-surface({r}{tone ? ` ${tone}` : ''})</code>
                <span className="esf__card-text">
                  {SURFACE_ROLES.includes(r) ? 'Padding, corners, colors, border and shadow, from the theme.' : 'Added to the theme: a rebuild compiles its rule.'}
                </span>
              </button>
            ))}
          </div>
          {tone && CANVAS_TONES.includes(tone) && role !== 'contained' && (
            <p className="esf__note">{tone} is a canvas color: as a tone it reads only on contained; on {role} its main is drawn on the page it is the color of.</p>
          )}
          <p className="esf__note">
            A tone replaces the role’s colors with a Palette family: contained takes its main as background and contrast as text,
            outlined and flat take its main as text (outlined as border too). Every other field stays the role’s.
          </p>
        </div>

        <div className="esf__editor">
          <code className="esf__written">surfaces.{role}</code>
          {Object.entries(SURFACE_PROPERTIES as Record<string, string>).map(([field, property]) => (
            <RoleField
              key={`${role}-${field}`}
              field={field}
              property={property}
              value={tokens[role]?.[field] ?? ''}
              groups={suggestions(activeThemeData, field)}
              label={`surfaces.${role}.${field}`}
              onWrite={(value) => write(field, value)}
            />
          ))}
          <div className="esf__users">
            <span className="esf__title">Built on @ds-surface({role})</span>
            {users.length > 0
              ? <ul className="esf__list">{users.map((path) => <li key={path}><code>{path}</code></li>)}</ul>
              : <span className="esf__note">No Button or Input role composes it.</span>}
            <span className="esf__note">
              Each field compiles to its own variable (<code>--uxdsl__surface__{role}-bg</code>…), so an edit here is a value
              change: it applies live, to every <code>@ds-surface({role})</code> and to the roles above.
            </span>
          </div>
        </div>
      </div>
      <UsageExample
        note={<>One line gives a container its padding, corners, colors, border and shadow; a tone swaps its colors for a Palette family&apos;s.</>}
        blocks={[{ label: 'In a stylesheet (.uxdsl)', code: usage.stylesheet }, jsonBlock(usage.excerpt)]}
      >
        {surfaceClass(role, tone) && (
          <Result label=".card">
            <div className={surfaceClass(role, tone)}>@ds-surface({role}{tone ? ` ${tone}` : ''})</div>
          </Result>
        )}
      </UsageExample>
    </InteractiveDemoContainer>
  )
}
