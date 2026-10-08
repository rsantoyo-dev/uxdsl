'use client'

// MIG-B7-17 (FEAT-009), phase C: the pure runtime functions — resolution, the engines the
// directives emit with, and the fonts helpers — called on the active theme. They change no
// state, so they run on the page itself, against what ThemeContext applied.

import { useEffect, useMemo, useState } from 'react'
import type { Declaration } from 'postcss'
import {
  resolveTheme,
  DEFAULT_THEME,
  googleFontsImportUrls,
  generateThemeCss,
  DEFAULT_BREAKPOINTS,
} from 'uxdsl/theme'
import {
  buttonDeclarations,
  inputDeclarations,
  resolveTypographyRole,
  getButtonTokens,
  getInputTokens,
  encodeGoogleFontFamily,
  tokenValueToCss,
  analyzeResponsiveValue,
  themeStructure,
  structuralChanges,
  inspectReferences,
} from 'uxdsl/engine'
import { getToneFamilies, validateResponsiveExpression } from 'uxdsl/language'
import { useTheme } from './ThemeContext'

const DEFAULT_OVERRIDE = `{
  "palette": {
    "primary": { "main": "#0f766e" }
  }
}`

/** resolveTheme(override) next to DEFAULT_THEME: which leaves the override set and which it inherited. */
export function ThemeResolution() {
  const [text, setText] = useState(DEFAULT_OVERRIDE)
  const outcome = useMemo(() => {
    try {
      const override = JSON.parse(text)
      const effective = resolveTheme(override)
      const base = DEFAULT_THEME
      // What applyTheme would do with it: the same structural comparison it runs
      // before touching the page (a value change applies, a structural one asks
      // for a rebuild).
      const changes = structuralChanges(themeStructure(base, generateThemeCss(base)), themeStructure(effective, generateThemeCss(effective)))
      const rows = Object.entries(effective.palette?.primary || {}).map(([variant, value]) => ({
        variant,
        value: String(value),
        source: override?.palette?.primary?.[variant] !== undefined ? 'your override' : 'base',
        base: String(base.palette?.primary?.[variant] ?? '—'),
      }))
      return { ok: true as const, rows, families: Object.keys(effective).length, changes }
    } catch (error) {
      return { ok: false as const, message: error instanceof Error ? error.message.split('\n')[0] : String(error) }
    }
  }, [text])

  return (
    <div className="cap-card" data-testid="theme-resolution">
      <h3 className="cap-card__title"><code>resolveTheme(override)</code> and <code>DEFAULT_THEME</code></h3>
      <label className="cap-label" htmlFor="cap-override">A partial override</label>
      <textarea id="cap-override" className="cap-field cap-field--code" rows={6} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-invalid={!outcome.ok} />
      {outcome.ok ? (
        <div className="cap-table-wrap">
          <table>
            <caption>Effective <code>palette.primary</code> ({outcome.families} families in the resolved theme)</caption>
            <thead><tr><th>Variant</th><th>resolveTheme</th><th>From</th><th>DEFAULT_THEME</th></tr></thead>
            <tbody>{outcome.rows.map((r) => <tr key={r.variant}><td><code>{r.variant}</code></td><td><code>{r.value}</code></td><td>{r.source}</td><td><code>{r.base}</code></td></tr>)}</tbody>
          </table>
        </div>
      ) : <p className="cap-result cap-result--error" role="alert">{outcome.message}</p>}
      {outcome.ok && (
        <p className="cap-note" data-testid="theme-structure">
          <code>structuralChanges(themeStructure(…))</code>: {outcome.changes.length
            ? <>a rebuild is needed — {outcome.changes.join('; ')}</>
            : <>values only, so <code>applyTheme</code> would apply it without a rebuild</>}
        </p>
      )}
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

/** The one value grammar: what a theme value compiles to, and how a responsive value groups. */
export function ValueGrammar() {
  const { activeThemeData } = useTheme()
  const theme = activeThemeData
  const [value, setValue] = useState('palette(primary.main, 0.5)')
  const [responsive, setResponsive] = useState('xs(1rem) md(2rem) !important')
  const compiled = useMemo(() => {
    try { return { ok: true as const, css: tokenValueToCss(value, theme) } }
    catch (error) { return { ok: false as const, message: error instanceof Error ? error.message.split('\n')[0] : String(error) } }
  }, [value, theme])
  const analysis = useMemo(() => {
    const bps = { ...DEFAULT_BREAKPOINTS, ...(theme?.breakpoints || {}) }
    try {
      validateResponsiveExpression(responsive, bps)
      return { ok: true as const, result: analyzeResponsiveValue(responsive, bps) }
    }
    catch (error) { return { ok: false as const, message: error instanceof Error ? error.message.split('\n')[0] : String(error) } }
  }, [responsive, theme])

  return (
    <div className="cap-card" data-testid="value-grammar">
      <h3 className="cap-card__title"><code>tokenValueToCss</code> · <code>validateResponsiveExpression</code> · <code>analyzeResponsiveValue</code></h3>
      <label className="cap-label" htmlFor="cap-token-value">A theme value</label>
      <input id="cap-token-value" className="cap-field" value={value} onChange={(e) => setValue(e.target.value)} spellCheck={false} aria-invalid={!compiled.ok} />
      {compiled.ok
        ? <p className="cap-note"><code>tokenValueToCss</code> → <code>{compiled.css}</code></p>
        : <p className="cap-result cap-result--error" role="alert">{compiled.message}</p>}
      <label className="cap-label" htmlFor="cap-responsive-value">A responsive value</label>
      <input id="cap-responsive-value" className="cap-field" value={responsive} onChange={(e) => setResponsive(e.target.value)} spellCheck={false} aria-invalid={!analysis.ok} />
      {analysis.ok ? (
        <div className="cap-table-wrap">
          <table>
            <caption>Groups of breakpoint functions ({analysis.result.standalone ? 'the whole value' : 'inside a larger value'})</caption>
            <thead><tr><th>Breakpoints</th><th>Base</th><th>!important</th></tr></thead>
            <tbody>{analysis.result.groups.map((group, i) => <tr key={i}><td><code>{group.names.join(' ')}</code></td><td>{group.hasBase ? 'yes' : 'no'}</td><td>{group.important ? 'yes' : 'no'}</td></tr>)}</tbody>
          </table>
        </div>
      ) : <p className="cap-result cap-result--error" role="alert">{analysis.message}</p>}
    </div>
  )
}

type Postcss = typeof import('postcss').default

/** The reference check the compiler runs on every build, on CSS typed here against the active theme. */
export function ReferenceCheck() {
  const { activeThemeData } = useTheme()
  const [css, setCss] = useState('.card {\n  color: var(--uxdsl__palette__primary-main);\n  background: var(--uxdsl__palette__brand-main);\n}')
  // The CSS typed here is parsed with PostCSS, loaded on the client when the
  // card mounts. A static import would make this module an async one on the
  // server (Next externalizes the app's own postcss as ESM), and an async
  // client module referenced from the MDX page renders as undefined.
  const [postcss, setPostcss] = useState<Postcss | null>(null)
  useEffect(() => {
    let live = true
    import('postcss').then((mod) => { if (live) setPostcss(() => mod.default) })
    return () => { live = false }
  }, [])
  const outcome = useMemo(() => {
    if (!postcss) return { ok: true as const, issues: [] as string[], loading: true }
    try {
      const root = postcss.parse(css)
      const consumers: Declaration[] = []
      root.walkDecls((decl) => { consumers.push(decl) })
      const issues = inspectReferences(root, consumers, { css: [generateThemeCss(activeThemeData)] })
      return { ok: true as const, issues: issues.map((issue) => issue.message), loading: false }
    } catch (error) {
      return { ok: false as const, message: error instanceof Error ? error.message.split('\n')[0] : String(error) }
    }
  }, [css, activeThemeData, postcss])

  return (
    <div className="cap-card" data-testid="reference-check">
      <h3 className="cap-card__title"><code>inspectReferences</code></h3>
      <label className="cap-label" htmlFor="cap-reference-css">Compiled CSS that uses theme variables</label>
      <textarea id="cap-reference-css" className="cap-field cap-field--code" rows={5} value={css} onChange={(e) => setCss(e.target.value)} spellCheck={false} aria-invalid={outcome.ok && outcome.issues.length > 0} />
      {outcome.ok ? (
        outcome.loading ? <p className="cap-note">Loading PostCSS…</p>
        : outcome.issues.length
          ? <ul className="cap-log">{outcome.issues.map((issue) => <li key={issue}><code>{issue}</code></li>)}</ul>
          : <p className="cap-note">Every <code>var(--uxdsl__…)</code> resolves against the active theme.</p>
      ) : <p className="cap-result cap-result--error" role="alert">{outcome.message}</p>}
    </div>
  )
}
