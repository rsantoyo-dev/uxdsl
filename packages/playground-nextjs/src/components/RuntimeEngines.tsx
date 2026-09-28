'use client'

// MIG-B7-17 (FEAT-009), phase C: the pure runtime functions — resolution, the engines the
// directives emit with, and the fonts helpers — called on the active theme. They change no
// state, so they run on the page itself, against what ThemeContext applied.

import { useEffect, useMemo, useState } from 'react'
import {
  resolveTheme,
  getDefaultTheme,
  buttonDeclarations,
  inputDeclarations,
  resolveTypographyRole,
  getButtonTokens,
  getInputTokens,
  googleFontsImportUrls,
  encodeGoogleFontFamily,
} from 'postcss-uxdsl/ds-runtime'
import { getToneFamilies } from 'postcss-uxdsl/language'
import { useTheme } from './ThemeContext'

const DEFAULT_OVERRIDE = `{
  "palette": {
    "primary": { "main": "#0f766e" }
  }
}`

/** resolveTheme(override) next to getDefaultTheme(): which leaves the override set and which it inherited. */
export function ThemeResolution() {
  const [text, setText] = useState(DEFAULT_OVERRIDE)
  const outcome = useMemo(() => {
    try {
      const override = JSON.parse(text)
      const effective = resolveTheme(override)
      const base = getDefaultTheme()
      const rows = Object.entries(effective.palette?.primary || {}).map(([variant, value]) => ({
        variant,
        value: String(value),
        source: override?.palette?.primary?.[variant] !== undefined ? 'your override' : 'base',
        base: String(base.palette?.primary?.[variant] ?? '—'),
      }))
      return { ok: true as const, rows, families: Object.keys(effective).length }
    } catch (error) {
      return { ok: false as const, message: error instanceof Error ? error.message.split('\n')[0] : String(error) }
    }
  }, [text])

  return (
    <div className="cap-card" data-testid="theme-resolution">
      <h3 className="cap-card__title"><code>resolveTheme(override)</code> and <code>getDefaultTheme()</code></h3>
      <label className="cap-label" htmlFor="cap-override">A partial override</label>
      <textarea id="cap-override" className="cap-field cap-field--code" rows={6} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-invalid={!outcome.ok} />
      {outcome.ok ? (
        <div className="cap-table-wrap">
          <table>
            <caption>Effective <code>palette.primary</code> ({outcome.families} families in the resolved theme)</caption>
            <thead><tr><th>Variant</th><th>resolveTheme</th><th>From</th><th>getDefaultTheme</th></tr></thead>
            <tbody>{outcome.rows.map((r) => <tr key={r.variant}><td><code>{r.variant}</code></td><td><code>{r.value}</code></td><td>{r.source}</td><td><code>{r.base}</code></td></tr>)}</tbody>
          </table>
        </div>
      ) : <p className="cap-result cap-result--error" role="alert">{outcome.message}</p>}
      <p className="cap-note">Override only <code>main</code> and <code>dark</code>/<code>contrast</code> come from the base: the same merge <code>uxdsl theme --diff</code> labels leaf by leaf (see the CLI page).</p>
    </div>
  )
}

type Family = 'button' | 'input' | 'typography'

/** What a directive expands to, from the same functions the compiler calls. */
export function DirectiveDeclarations() {
  const { activeThemeData } = useTheme()
  const theme = activeThemeData
  const [family, setFamily] = useState<Family>('button')
  const roles = useMemo(() => {
    if (family === 'button') return Object.keys(getButtonTokens(theme))
    if (family === 'input') return Object.keys(getInputTokens(theme))
    return Object.keys(theme.typography_details || {})
  }, [family, theme])
  const tones = useMemo(() => getToneFamilies(theme.palette || {}), [theme])
  const [role, setRole] = useState('contained')
  const [tone, setTone] = useState('')
  const activeRole = roles.includes(role) ? role : roles[0]

  const result = useMemo(() => {
    try {
      if (family === 'typography') {
        const style = resolveTypographyRole(theme.typography_details || {}, activeRole)
        return { ok: true as const, directive: `@ds-typo(${activeRole})`, groups: { fields: (style || {}) as Record<string, string> } }
      }
      const fn = family === 'button' ? buttonDeclarations : inputDeclarations
      const { base, states } = fn(theme, activeRole, tone)
      return { ok: true as const, directive: `@ds-${family}(${[activeRole, tone].filter(Boolean).join(' ')})`, groups: { base, ...states } as Record<string, Record<string, string>> }
    } catch (error) {
      return { ok: false as const, message: error instanceof Error ? error.message : String(error) }
    }
  }, [family, activeRole, tone, theme])

  return (
    <div className="cap-card" data-testid="directive-declarations">
      <h3 className="cap-card__title"><code>buttonDeclarations</code> · <code>inputDeclarations</code> · <code>resolveTypographyRole</code></h3>
      <div className="cap-controls">
        <label className="cap-label">Family
          <select className="cap-field" value={family} onChange={(e) => setFamily(e.target.value as Family)}>
            <option value="button">Button</option><option value="input">Input</option><option value="typography">Typography</option>
          </select>
        </label>
        <label className="cap-label">Role
          <select className="cap-field" value={activeRole} onChange={(e) => setRole(e.target.value)}>
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        {family !== 'typography' && (
          <label className="cap-label">Tone
            <select className="cap-field" value={tone} onChange={(e) => setTone(e.target.value)}>
              <option value="">(none)</option>
              {tones.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        )}
      </div>
      {result.ok ? (
        <>
          <p className="cap-note">What <code>{result.directive}</code> emits for the active theme:</p>
          {Object.entries(result.groups).map(([group, declarations]) => (
            <div key={group} className="cap-table-wrap">
              <table>
                <caption>{group === 'base' || group === 'fields' ? group : `state: ${group}`}</caption>
                <tbody>{Object.entries(declarations).map(([property, value]) => <tr key={property}><td><code>{property}</code></td><td><code>{String(value)}</code></td></tr>)}</tbody>
              </table>
            </div>
          ))}
        </>
      ) : <p className="cap-result cap-result--error" role="alert">{result.message}</p>}
    </div>
  )
}

/** The Google Fonts URLs of the active theme — and whether the page's own theme stylesheet imports exactly those. */
export function FontsImport() {
  const { activeThemeData } = useTheme()
  const urls = useMemo(() => googleFontsImportUrls(activeThemeData?.fonts?.google), [activeThemeData])
  const [family, setFamily] = useState('Noto Sans JP:wght@400;700')
  const [inSheet, setInSheet] = useState<boolean[] | null>(null)

  useEffect(() => {
    const sheet = document.getElementById('uxdsl-ssr-theme')?.textContent || ''
    setInSheet(urls.map((url) => sheet.includes(`@import url('${url}')`) || sheet.includes(`@import url("${url}")`) || sheet.includes(url)))
  }, [urls])

  return (
    <div className="cap-card" data-testid="fonts-import">
      <h3 className="cap-card__title"><code>googleFontsImportUrls</code> · <code>encodeGoogleFontFamily</code></h3>
      <p className="cap-note">The active theme&apos;s <code>fonts.google</code>, as the <code>@import</code> URLs the compiler and <code>generateThemeCss</code> both emit:</p>
      <ul className="cap-log">
        {urls.length === 0 ? <li>This theme loads no Google font.</li> : urls.map((url, i) => (
          <li key={url}><code className="cap-block">{url}</code> {inSheet ? (inSheet[i] ? '— imported by this page\'s theme stylesheet' : '— NOT found in this page\'s theme stylesheet') : ''}</li>
        ))}
      </ul>
      <label className="cap-label" htmlFor="cap-font-family">A family spec</label>
      <input id="cap-font-family" className="cap-field" value={family} onChange={(e) => setFamily(e.target.value)} spellCheck={false} />
      <p className="cap-note"><code>encodeGoogleFontFamily</code> → <code>{encodeGoogleFontFamily(family)}</code></p>
    </div>
  )
}
