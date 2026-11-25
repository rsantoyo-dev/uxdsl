'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  getSurfaceTokens,
  getButtonTokens,
  getInputTokens,
  BUTTON_PROPERTIES,
  BUTTON_STATES,
  INPUT_PROPERTIES,
  INPUT_STATES,
} from 'uxdsl/engine'
import { useTheme } from './ThemeContext'
import { InteractiveDemoContainer } from './InteractiveDemoContainer'
import RoleField from './RoleField'
import { TONES } from './SurfacesEditor'
import { suggestions, rolePatch, baseFields, stateFields } from '../lib/role-editing'
import { checkPatch } from '../lib/theme-patch'

type Family = 'buttons' | 'inputs'
type Token = { surface?: string; base?: Record<string, string>; states?: Record<string, Record<string, string>> }

// ControlsEditor.uxdsl generates a class per role of the base theme and per tone, each one
// @ds-button(role tone) or @ds-input(role tone) itself.
const ROLES: Record<Family, string[]> = { buttons: ['contained', 'outlined', 'flat'], inputs: ['contained', 'outlined', 'underline'] }
const ENGINE = {
  buttons: { properties: BUTTON_PROPERTIES as Record<string, string>, states: BUTTON_STATES as Record<string, string[]>, directive: '@ds-button', tokens: getButtonTokens },
  inputs: { properties: INPUT_PROPERTIES as Record<string, string>, states: INPUT_STATES as Record<string, string[]>, directive: '@ds-input', tokens: getInputTokens },
}
const selected = (on: boolean) => (on ? ' is-selected' : '')
const controlClass = (family: Family, role: string, tone: string) =>
  (ROLES[family].includes(role) ? `ecl-${family === 'buttons' ? 'b' : 'i'}--${role}${tone ? `-${tone}` : ''}` : '')

/** Adds a field the role does not emit yet: checked like any edit, which says when a rebuild is needed. */
function AddField({ fields, label, onAdd }: { fields: string[]; label: string; onAdd: (field: string) => string | null }) {
  const [error, setError] = useState<string | null>(null)
  if (!fields.length) return null
  return (
    <div className="ecl__add">
      <select className="esf__select" value="" onChange={(event) => event.target.value && setError(onAdd(event.target.value))} aria-label={label}>
        <option value="">{label}…</option>
        {fields.map((field) => <option key={field} value={field}>{field}</option>)}
      </select>
      {error && <p className="rf__error" role="alert">{error}</p>}
    </div>
  )
}

/** The chosen role in every state the page can show at once; hover and keyboard focus are live. */
function StatePreview({ family, role, tone }: { family: Family; role: string; tone: string }) {
  const cls = controlClass(family, role, tone)
  if (family === 'buttons') {
    return (
      <div className="ecl__states">
        <figure className="ecl__state"><button type="button" className={cls}>Button</button><figcaption>base</figcaption></figure>
        <figure className="ecl__state"><button type="button" className={cls}>Hover me</button><figcaption>hover · focus with Tab</figcaption></figure>
        <figure className="ecl__state"><button type="button" className={`${cls} is-selected`} aria-pressed="true">Selected</button><figcaption>selected</figcaption></figure>
        <figure className="ecl__state"><button type="button" className={cls} disabled>Disabled</button><figcaption>disabled</figcaption></figure>
      </div>
    )
  }
  return (
    <div className="ecl__states">
      <figure className="ecl__state"><input className={cls} placeholder="Placeholder" aria-label="Empty field" /><figcaption>base · placeholder</figcaption></figure>
      <figure className="ecl__state"><input className={cls} defaultValue="Hover, then click" aria-label="Filled field" /><figcaption>hover · focus</figcaption></figure>
      <figure className="ecl__state"><input className={cls} defaultValue="Read only" readOnly aria-label="Read-only field" /><figcaption>readonly</figcaption></figure>
      <figure className="ecl__state"><input className={cls} defaultValue="not an email" aria-invalid="true" aria-label="Invalid field" /><figcaption>invalid</figcaption></figure>
      <figure className="ecl__state"><input className={cls} defaultValue="Disabled" disabled aria-label="Disabled field" /><figcaption>disabled</figcaption></figure>
    </div>
  )
}

/**
 * Edits the Button and Input roles of the active theme (`buttons`, `inputs`): the Surface a
 * role composes, the base fields it gives itself over that Surface, and each interaction
 * state. The role is drawn in its states with the chosen tone, and every role of the family
 * below it. A value change applies live; a change to what a role emits (a new field, a new
 * state, another Surface) is checked first and explained, since only a rebuild compiles it.
 */
export default function ControlsEditor() {
  const { activeThemeData, setCustomTheme, customThemeName } = useTheme()
  const [family, setFamily] = useState<Family>('buttons')
  const engine = ENGINE[family]
  const tokens: Record<string, Token> = useMemo(() => engine.tokens(activeThemeData), [engine, activeThemeData])
  const surfaces: Record<string, Record<string, string>> = useMemo(() => getSurfaceTokens(activeThemeData), [activeThemeData])
  const roles = useMemo(() => Object.keys(tokens), [tokens])
  const [role, setRole] = useState('contained')
  const [tone, setTone] = useState('')
  useEffect(() => { if (roles.length && !roles.includes(role)) setRole(roles[0]) }, [roles, role])
  const tones = useMemo(() => TONES.filter((t) => activeThemeData?.palette?.[t]), [activeThemeData])

  const token = tokens[role] || {}
  const base = baseFields(token, surfaces[token.surface || ''], engine.properties)
  const states = stateFields(token, engine.states)
  const missingStates = Object.keys(engine.states).filter((state) => !states.some((s) => s.state === state))

  const write = (field: string, value: string, state?: string): string | null => {
    const patch = rolePatch(family, role, field, value, { state })
    const checked = checkPatch(activeThemeData, patch)
    if (!checked.ok) return checked.message ?? 'The theme refused this value.'
    try {
      setCustomTheme(customThemeName || 'Custom Theme', patch)
      return null
    } catch (cause) {
      return cause instanceof Error ? cause.message : String(cause)
    }
  }
  const firstSuggestion = (field: string) => suggestions(activeThemeData, field, { controls: true })[0]?.values[0] ?? 'none'

  return (
    <InteractiveDemoContainer
      title="Buttons / Inputs"
      toolbar={
        <div className="esf__toolbar">
          <div className="esf__chips" role="radiogroup" aria-label="Family">
            {(['buttons', 'inputs'] as Family[]).map((f) => (
              <button key={f} type="button" role="radio" aria-checked={f === family} className={`esf__chip${selected(f === family)}`} onClick={() => setFamily(f)}>
                {f === 'buttons' ? 'Buttons' : 'Inputs'}
              </button>
            ))}
          </div>
          <div className="esf__chips" role="radiogroup" aria-label="Role">
            {roles.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={r === role} className={`esf__chip${selected(r === role)}`} onClick={() => setRole(r)}>{r}</button>
            ))}
          </div>
          <label className="esf__tone">
            <span className="esf__hint">Tone</span>
            <select className="esf__select" value={tone} onChange={(event) => setTone(event.target.value)} aria-label="Tone of the preview">
              <option value="">none (primary)</option>
              {tones.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>
      }
    >
      <div className="esf">
        <div className="esf__preview">
          <div className="ecl__stage">
            <code className="ecl__stage-label">{engine.directive}({role}{tone ? ` ${tone}` : ''})</code>
            {ROLES[family].includes(role)
              ? <StatePreview family={family} role={role} tone={tone} />
              : <p className="esf__note">Added to the theme: a rebuild compiles its rule.</p>}
          </div>
          <div className="ecl__stage">
            <code className="ecl__stage-label">Every {family === 'buttons' ? 'Button' : 'Input'} role{tone ? `, tone ${tone}` : ''}</code>
            <div className="ecl__roles">
              {ROLES[family].map((r) => family === 'buttons'
                ? <button key={r} type="button" className={controlClass(family, r, tone)} onClick={() => setRole(r)}>{r}</button>
                : <input key={r} className={controlClass(family, r, tone)} placeholder={r} aria-label={`${r} field`} onFocus={() => setRole(r)} />)}
            </div>
          </div>
          <p className="esf__note">
            <code>tone(main)</code>, <code>tone(dark)</code> and <code>tone(contrast)</code> follow the tone a component asks for
            (<code>{engine.directive}({role} success)</code>), and primary when it asks for none. A <code>palette(…)</code> value stays that role whatever the tone.
          </p>
        </div>

        <div className="esf__editor">
          <code className="esf__written">{family}.{role}</code>
          <RoleField field="surface" value={`@ds-surface(${token.surface || '—'})`} badge="needs a rebuild to change" inherited groups={[]} label={`${family}.${role}.surface`} />

          <span className="esf__title">Base</span>
          {base.map((item) => (
            <RoleField
              key={`${family}-${role}-base-${item.field}`}
              field={item.field}
              property={engine.properties[item.field]}
              value={item.value}
              badge={item.source === 'role' ? role : `from surfaces.${token.surface}`}
              inherited={item.source !== 'role'}
              groups={suggestions(activeThemeData, item.field, { controls: true })}
              label={`${family}.${role}.base.${item.field}`}
              onWrite={item.source === 'role' ? (value) => write(item.field, value) : undefined}
              action={item.source === 'role' ? undefined : { label: 'Override here', onClick: () => { write(item.field, item.value) } }}
            />
          ))}
          <AddField
            key={`${family}-${role}-base`}
            fields={Object.keys(engine.properties).filter((field) => !base.some((item) => item.field === field))}
            label="Add a base field"
            onAdd={(field) => write(field, firstSuggestion(field))}
          />

          {states.map(({ state, fields }) => (
            <div key={state} className="ecl__state-fields">
              <span className="esf__title">{state} <code className="ecl__selector">{engine.states[state].join(', ')}</code></span>
              {fields.map((item) => (
                <RoleField
                  key={`${family}-${role}-${state}-${item.field}`}
                  field={item.field}
                  property={engine.properties[item.field]}
                  value={item.value}
                  groups={suggestions(activeThemeData, item.field, { controls: true })}
                  label={`${family}.${role}.states.${state}.${item.field}`}
                  onWrite={(value) => write(item.field, value, state)}
                />
              ))}
              <AddField
                key={`${family}-${role}-${state}`}
                fields={Object.keys(engine.properties).filter((field) => !fields.some((item) => item.field === field))}
                label={`Add a field to ${state}`}
                onAdd={(field) => write(field, firstSuggestion(field), state)}
              />
            </div>
          ))}
          <AddField
            key={`${family}-${role}-states`}
            fields={missingStates}
            label="Add a state"
            onAdd={(state) => write('opacity', '1', state)}
          />
          <p className="esf__note">
            Every field compiles to its own variable, so a value applies live, in every tone. A field or a state the role does
            not emit yet changes the compiled CSS itself: the editor says so, and the theme file and a rebuild apply it.
          </p>
        </div>
      </div>
    </InteractiveDemoContainer>
  )
}
