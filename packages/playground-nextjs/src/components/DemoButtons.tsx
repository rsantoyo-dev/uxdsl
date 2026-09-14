 'use client'

import { useEffect, useMemo, useState } from 'react'
import { generateButtonCss, getButtonTokens, inspectButtonTheme, buttonComponentCss, generateSurfaceCss, generateEdgeCss, generateShadowCss, getEdgeTokens } from 'postcss-uxdsl/ds-runtime'
import { generateDensityCss, DEFAULT_BREAKPOINTS, DEFAULT_DENSITIES } from 'postcss-uxdsl/ds-runtime'
import { useTheme } from './ThemeContext'

export default function DemoButtons() {
  const { activeThemeData } = useTheme()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [tone, setTone] = useState('')
  const [size, setSize] = useState('')
  const [selected, setSelected] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, unknown> | null>(null)
  const [viewport, setViewport] = useState(0)
  const theme = useMemo(() => ({ ...activeThemeData, ...overrides }), [activeThemeData, overrides])
  const tokens = useMemo(() => getButtonTokens(theme), [theme])
  const css = useMemo(() => [generateDensityCss({ ...DEFAULT_DENSITIES, ...theme.densities }, { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }, '#DemoButtons'), generateEdgeCss(theme, undefined, '#DemoButtons'), generateShadowCss(theme, undefined, '#DemoButtons'), generateSurfaceCss(theme, undefined, '#DemoButtons'), generateButtonCss(theme, undefined, '#DemoButtons'), ...Object.keys(tokens).map(role => buttonComponentCss(theme, `#DemoButtons [data-button-role="${role}"]`, role, tone, size))].join('\n'), [theme, tokens, tone, size])
  const values = useMemo(() => inspectButtonTheme(theme, viewport), [theme, viewport])
  function reset() {
    setOverrides(null); setTone(''); setSize(''); setError('')
    setDraft(JSON.stringify({ breakpoints: activeThemeData.breakpoints, buttons: getButtonTokens(activeThemeData) }, null, 2))
  }
  useEffect(() => {
    setOverrides(null); setTone(''); setSize(''); setError('')
    setDraft(JSON.stringify({ breakpoints: activeThemeData.breakpoints, buttons: getButtonTokens(activeThemeData) }, null, 2))
  }, [activeThemeData])
  useEffect(() => {
    const update = () => setViewport(window.innerWidth)
    update(); window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  function apply() {
    try {
      const next = JSON.parse(draft)
      if (!next || typeof next !== 'object' || Array.isArray(next)) throw new Error('Expected a theme object.')
      const candidate = { ...activeThemeData, ...next }
      generateDensityCss({ ...DEFAULT_DENSITIES, ...candidate.densities }, { ...DEFAULT_BREAKPOINTS, ...candidate.breakpoints })
      generateButtonCss(candidate); generateSurfaceCss(candidate); generateEdgeCss(candidate); generateShadowCss(candidate)
      for (const role of Object.keys(getButtonTokens(candidate))) buttonComponentCss(candidate, '.preview', role, tone, size)
      setOverrides(next); setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
  }
  return <div id="DemoButtons" className="buttons-section demo-section">
    <style dangerouslySetInnerHTML={{ __html: css.replace(/</g, '\\3c ') }} />
    <section className="section">
      <h2 className="section-title">Shared engine playground</h2>
      <p>Actual viewport: {viewport}px. Resize the browser to test responsive values. Hover, focus with the keyboard, or press a preview button to inspect configured states. JSON edits are scoped to this demo and do not save source files.</p>
      <label htmlFor="button-theme">Buttons and breakpoint configuration</label>
      <textarea id="button-theme" value={draft} onChange={e => setDraft(e.target.value)} rows={18} style={{ width: '100%', fontFamily: 'monospace' }} />
      <button type="button" onClick={apply}>Apply preview</button>
      <button type="button" onClick={reset}>Reset to active theme</button>
      {error && <p role="alert">{error} The last valid preview remains active.</p>}
    </section>
    <section className="section">
      <label htmlFor="button-tone">Palette tone (optional)</label>
      <select id="button-tone" value={tone} onChange={e => setTone(e.target.value)}><option value="">Use configured colors</option>{Object.keys(theme.palette || {}).filter(key => /^[a-z][a-z0-9-]*$/.test(key) && typeof theme.palette[key] === 'object').map(key => <option key={key}>{key}</option>)}</select>
      <label htmlFor="button-size">Size (Density and Radius)</label>
      <select id="button-size" value={size} onChange={e => setSize(e.target.value)}><option value="">Use configured size</option>{Object.keys(getEdgeTokens(theme).radii).filter(key => /^\d+$/.test(key) && ({ ...DEFAULT_DENSITIES, ...theme.densities })[key]).map(key => <option key={key}>{key}</option>)}</select>
      <label><input type="checkbox" checked={selected} onChange={e => setSelected(e.target.checked)} />Selected (aria-pressed)</label>
      <label><input type="checkbox" checked={disabled} onChange={e => setDisabled(e.target.checked)} />Disabled</label>
      <div className="surfaces-grid">{Object.keys(tokens).map(role => <div key={role}>
        <button type="button" data-button-role={role} aria-pressed={selected} disabled={disabled}>{role} action</button>
        <pre>{`.action { @ds-button(${role}${tone ? ` ${tone}` : ''}${size ? ` ${size}` : ''}); }`}</pre>
        <details><summary>CSS from the shared engine</summary><pre>{buttonComponentCss(theme, '.action', role, tone, size)}</pre><pre>{JSON.stringify(Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith(`--button-${role}-`))), null, 2)}</pre></details>
      </div>)}</div>
    </section>
  </div>
}
