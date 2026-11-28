'use client'

import { useEffect, useMemo, useState } from 'react'
import { responsiveEntries, resolveResponsiveValue, inspectResponsiveValue } from 'uxdsl/language'
import { compileTypographyRules } from 'uxdsl/engine'
import { useTheme } from './ThemeContext'
import UsageExample, { jsonBlock, Result } from './UsageExample'
import { typographyUsage, typographySelector } from '../lib/usage-snippets'
import { useBreakpoints } from './BreakpointsProvider'
import { InteractiveDemoContainer } from './InteractiveDemoContainer'
import { lengthPx, buildDefinition, densityKeys, spaceKeyOf } from '../lib/density-editing'
import {
  FONT_PRESETS,
  roleOrder,
  fieldsOf,
  fieldPatch,
  cssName,
  familyOptions,
  fontPresetPatch,
  presetOf,
} from '../lib/typography-editing'

// Every role is shown through a class TypographyEditor.uxdsl generates with @ds-typo(role),
// so what you see is what the theme gives at this width, and it follows every edit.
const typo = (role: string) => `tye-typo--${role}`
const selected = (on: boolean) => (on ? ' is-selected' : '')
const WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900']
const SAMPLE = 'The quick brown fox jumps over the lazy dog'

type Field = { field: string; value: string; own: boolean }

/** One field of a role: a control that fits it, the written value, and where it comes from. */
function FieldRow({ role, item, fonts, onWrite }: { role: string; item: Field; fonts: { families?: Record<string, string> }; onWrite: (field: string, value: string) => string | null }) {
  const [text, setText] = useState(item.value)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setText(item.value); setError(null) }, [item.value])
  const write = (value: string) => setError(onWrite(item.field, value))
  const responsive = /\b[a-z][a-z0-9-]*\(/i.test(item.value) && !/^var\(|^space\(/i.test(item.value)
  const families = familyOptions(fonts)

  return (
    <div className="tye__field">
      <div className="tye__field-head">
        <code className="tye__field-name">{item.field}</code>
        <span className={`tye__badge${item.own ? '' : ' is-inherited'}`}>{item.own ? role : 'from default'}</span>
      </div>
      <div className="tye__field-controls">
        {item.field === 'fontWeight' && !responsive && (
          <select className="tye__select" value={WEIGHTS.includes(item.value) ? item.value : ''} onChange={(event) => write(event.target.value)} aria-label={`${role} fontWeight`}>
            {!WEIGHTS.includes(item.value) && <option value="">{item.value}</option>}
            {WEIGHTS.map((weight) => <option key={weight} value={weight}>{weight}</option>)}
          </select>
        )}
        {item.field === 'fontFamily' && families.length > 0 && (
          <select
            className="tye__select"
            value={families.some((family) => family.value === item.value) ? item.value : ''}
            onChange={(event) => event.target.value && write(event.target.value)}
            aria-label={`${role} fontFamily`}
          >
            {!families.some((family) => family.value === item.value) && <option value="">as written</option>}
            {families.map((family) => <option key={family.name} value={family.value}>fonts.families.{family.name}</option>)}
          </select>
        )}
        <input
          type="text"
          className="tye__text"
          value={text}
          spellCheck={false}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => text.trim() !== item.value && write(text.trim())}
          onKeyDown={(event) => { if (event.key === 'Enter' && text.trim() !== item.value) write(text.trim()) }}
          aria-label={`typography_details.${role}.${item.field}`}
        />
      </div>
      {error && <p className="tye__error" role="alert">{error}</p>}
    </div>
  )
}

/**
 * Edits the text roles of the active theme (`typography_details`) and the fonts they use.
 * Pick a role: it is shown live at this width, its font size at every breakpoint, and each
 * field it emits can be changed, its own or one it takes from `default`. The whole scale
 * below follows, so a change to `default` shows in every role that inherits it. Changes go
 * through setCustomTheme → applyTheme like every part.
 */
export default function TypographyEditor({ defaultRole = 'h1' }: { defaultRole?: string }) {
  const { activeThemeData, setCustomTheme, customThemeName } = useTheme()
  const { breakpoints } = useBreakpoints()
  const details = useMemo(() => activeThemeData?.typography_details || {}, [activeThemeData])
  const fonts = activeThemeData?.fonts || {}
  const roles = useMemo(() => roleOrder(details), [details])
  const [role, setRole] = useState(defaultRole)
  const [sample, setSample] = useState(SAMPLE)
  const [viewport, setViewport] = useState<number | null>(null)
  const [fontError, setFontError] = useState<string | null>(null)
  useEffect(() => {
    const read = () => setViewport(window.innerWidth)
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])
  useEffect(() => { if (roles.length && !roles.includes(role)) setRole(roles[0]) }, [roles, role])

  const fields: Field[] = useMemo(() => fieldsOf(details, role), [details, role])
  const fontSize = fields.find((item) => item.field === 'fontSize')
  const spacing: Record<string, string> = activeThemeData?.spacing || {}
  const spaceKeys = useMemo(() => densityKeys(spacing), [spacing])
  const order = useMemo(() => Object.keys(breakpoints).sort((a, b) => breakpoints[a] - breakpoints[b]), [breakpoints])
  const entries = useMemo(() => (fontSize ? responsiveEntries(fontSize.value, breakpoints) : {}), [fontSize, breakpoints])
  const active = viewport === null || !fontSize ? null : inspectResponsiveValue(fontSize.value, viewport, breakpoints).active

  /** Writes one field; returns the error to show, or null. */
  const writeField = (field: string, value: string): string | null => {
    if (!value) return 'A field needs a value; to take default’s, write default’s value.'
    // Compile the role with the new value first: a responsive expression the engine
    // cannot read is refused here, with its message, instead of being dropped by the runtime.
    try {
      compileTypographyRules({ ...details, [role]: { ...(details[role] || {}), [field]: value } }, breakpoints, activeThemeData)
      setCustomTheme(customThemeName || 'Custom Theme', fieldPatch(role, field, value))
      return null
    } catch (cause) {
      return cause instanceof Error ? cause.message : String(cause)
    }
  }
  const setSizeAt = (bp: string, value: string) => {
    if (!fontSize) return
    writeField('fontSize', buildDefinition({ ...entries, [bp]: value }, order))
  }
  const choosePreset = (target: string, name: string) => {
    const preset = FONT_PRESETS.find((p) => p.name === name)
    if (!preset) return
    try {
      setCustomTheme(customThemeName || 'Custom Theme', fontPresetPatch(fonts, target, preset))
      setFontError(null)
    } catch (cause) {
      setFontError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const usage = useMemo(() => typographyUsage(activeThemeData, role), [activeThemeData, role])
  return (
    <InteractiveDemoContainer
      title="Typography"
      toolbar={
        <div className="tye__toolbar">
          <div className="tye__roles" role="radiogroup" aria-label="Text role">
            {roles.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={r === role} className={`tye__role${selected(r === role)}`} onClick={() => setRole(r)}>
                {r}
              </button>
            ))}
          </div>
          <span className="tye__hint">
            Pick a role: <code>@ds-typo({role})</code> below is live, and each field it emits can be changed.
          </span>
        </div>
      }
    >
      <div className="tye">
        <div className="tye__preview">
          <div className="tye__stage">
            <code className="tye__stage-label">
              @ds-typo({role}) · your window{active ? `: ${active}` : ''}
            </code>
            <p className={`tye__sample ${typo(role)}`}>{sample}</p>
            <input className="tye__sample-text" value={sample} onChange={(event) => setSample(event.target.value)} aria-label="Sample text" />
          </div>

          {fontSize && (
            <div className="tye__sizes">
              <span className="tye__title">Font size by breakpoint</span>
              {order.map((bp, index) => {
                const written = entries[bp] ?? ''
                const value = resolveResponsiveValue(fontSize.value, bp, breakpoints)
                const px = lengthPx(value, spacing)
                const custom = written && spaceKeyOf(written) === null
                return (
                  <label key={bp} className={`tye__size${active === bp ? ' is-active' : ''}`}>
                    <code className="tye__bp">{bp}</code>
                    <select className="tye__select" value={written} onChange={(event) => setSizeAt(bp, event.target.value)} aria-label={`${role} fontSize from ${bp}`}>
                      {index > 0 && <option value="">keeps the previous</option>}
                      {custom && <option value={written}>{written}</option>}
                      {spaceKeys.map((s) => <option key={s} value={`space(${s})`}>space({s}) · {spacing[s]}</option>)}
                    </select>
                    <span className="tye__px">{px === null ? value || '—' : `${px}px`}</span>
                    <span className="tye__tag">{active === bp ? 'your window' : written ? '' : 'keeps the previous'}</span>
                  </label>
                )
              })}
            </div>
          )}

          <div className="tye__fonts">
            <span className="tye__title">Fonts</span>
            {Object.entries((fonts.families || {}) as Record<string, string>).map(([name, stack]) => (
              <label key={name} className="tye__font">
                <code className="tye__bp">{name}</code>
                <select className="tye__select" value={presetOf(stack)?.name ?? ''} onChange={(event) => choosePreset(name, event.target.value)} aria-label={`fonts.families.${name}`}>
                  {!presetOf(stack) && <option value="">{stack}</option>}
                  {FONT_PRESETS.map((preset) => <option key={preset.name} value={preset.name}>{preset.name}</option>)}
                </select>
              </label>
            ))}
            <span className="tye__note">A font chosen here is loaded from Google Fonts: it writes <code>fonts.families</code> and <code>fonts.google</code>.</span>
            {fontError && <p className="tye__error" role="alert">{fontError}</p>}
          </div>
        </div>

        <div className="tye__editor">
          <div className="tye__written">
            <code>typography_details.{role}</code>
          </div>
          {fields.map((item) => (
            <FieldRow key={`${role}-${item.field}`} role={role} item={item} fonts={fonts} onWrite={writeField} />
          ))}
          <p className="tye__note">
            A role emits the fields it has and the ones it takes from <code>default</code>; each compiles to its own variable
            (<code>--uxdsl__typography__{role}-{cssName('fontSize')}</code>), so any of them changes live. Adding a field the role
            does not emit needs a rebuild.
          </p>
        </div>

        <div className="tye__scale">
          <span className="tye__title">The scale, live</span>
          {roles.map((r) => (
            <button key={r} type="button" className={`tye__scale-row${selected(r === role)}`} onClick={() => setRole(r)}>
              <code className="tye__scale-role">{r}</code>
              <span className={`tye__scale-sample ${typo(r)}`}>{sample}</span>
            </button>
          ))}
        </div>
      </div>
      <UsageExample
        note={<>The directive emits every field the role has, its own over <code>default</code>&apos;s. Keep the HTML element for the document&apos;s structure: an <code>h2</code> can wear <code>@ds-typo(h1)</code>.</>}
        blocks={[{ label: 'In a stylesheet (.uxdsl)', code: usage.stylesheet }, jsonBlock(usage.excerpt)]}
      >
        <Result label={typographySelector(role)}>
          <p className={`tye__use ${typo(role)}`}>The quick brown fox</p>
        </Result>
      </UsageExample>
    </InteractiveDemoContainer>
  )
}
