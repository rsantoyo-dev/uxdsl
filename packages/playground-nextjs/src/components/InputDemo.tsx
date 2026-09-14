 'use client'

import { useEffect, useMemo, useState } from 'react'
import { generateInputCss, getInputTokens, inspectInputTheme, inputComponentCss, generateSurfaceCss, generateEdgeCss, generateShadowCss, getEdgeTokens } from 'postcss-uxdsl/ds-runtime'
import { generateDensityCss, DEFAULT_BREAKPOINTS, getDensityTokens } from 'postcss-uxdsl/ds-runtime'
import { useTheme } from './ThemeContext'

export default function InputDemo() {
  const { activeThemeData } = useTheme()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [tone, setTone] = useState('')
  const [size, setSize] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, unknown> | null>(null)
  const [viewport, setViewport] = useState(0)
  const theme = useMemo(() => ({ ...activeThemeData, ...overrides }), [activeThemeData, overrides])
  const tokens = useMemo(() => getInputTokens(theme), [theme])
  const css = useMemo(() => [generateDensityCss(getDensityTokens(theme), { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints }, '#InputDemo'), generateEdgeCss(theme, undefined, '#InputDemo'), generateShadowCss(theme, undefined, '#InputDemo'), generateSurfaceCss(theme, undefined, '#InputDemo'), generateInputCss(theme, undefined, '#InputDemo'), ...Object.keys(tokens).map(role => inputComponentCss(theme, `#InputDemo [data-input-role="${role}"]`, role, tone, size))].join('\n'), [theme, tokens, tone, size])
  const values = useMemo(() => inspectInputTheme(theme, viewport), [theme, viewport])
  function reset() {
    setOverrides(null); setTone(''); setSize(''); setError('')
    setDraft(JSON.stringify({ breakpoints: activeThemeData.breakpoints, inputs: getInputTokens(activeThemeData) }, null, 2))
  }
  useEffect(() => {
    setOverrides(null); setTone(''); setSize(''); setError('')
    setDraft(JSON.stringify({ breakpoints: activeThemeData.breakpoints, inputs: getInputTokens(activeThemeData) }, null, 2))
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
      generateDensityCss(getDensityTokens(candidate), { ...DEFAULT_BREAKPOINTS, ...candidate.breakpoints })
      generateInputCss(candidate); generateSurfaceCss(candidate); generateEdgeCss(candidate); generateShadowCss(candidate)
      for (const role of Object.keys(getInputTokens(candidate))) inputComponentCss(candidate, '.preview', role, tone, size)
      setOverrides(next); setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
  }
  return <div id="InputDemo" className="inputs-section demo-section">
    <style dangerouslySetInnerHTML={{ __html: css.replace(/</g, '\\3c ') }} />
    <section className="section">
      <h2 className="section-title">Shared engine playground</h2>
      <p>Actual viewport: {viewport}px. Resize the browser to test responsive values. Hover or focus a field with the keyboard to inspect configured states. Try typing; readonly and disabled use native attributes. JSON edits are scoped to this demo and do not save source files.</p>
      <label htmlFor="input-theme">Inputs and breakpoint configuration</label>
      <textarea id="input-theme" value={draft} onChange={e => setDraft(e.target.value)} rows={18} style={{ width: '100%', fontFamily: 'monospace' }} />
      <button type="button" onClick={apply}>Apply preview</button>
      <button type="button" onClick={reset}>Reset to active theme</button>
      {error && <p role="alert">{error} The last valid preview remains active.</p>}
    </section>
    <section className="section">
      <label htmlFor="input-tone">Palette tone (optional)</label>
      <select id="input-tone" value={tone} onChange={e => setTone(e.target.value)}><option value="">Use configured colors</option>{Object.keys(theme.palette || {}).filter(key => /^[a-z][a-z0-9-]*$/.test(key) && typeof theme.palette[key] === 'object').map(key => <option key={key}>{key}</option>)}</select>
      <label htmlFor="input-size">Size (Density and Radius)</label>
      <select id="input-size" value={size} onChange={e => setSize(e.target.value)}><option value="">Use configured size</option>{Object.keys(getEdgeTokens(theme).radii).filter(key => /^\d+$/.test(key) && (getDensityTokens(theme))[key]).map(key => <option key={key}>{key}</option>)}</select>
      <label><input type="checkbox" checked={invalid} onChange={e => setInvalid(e.target.checked)} />Invalid (aria-invalid)</label>
      <label><input type="checkbox" checked={readOnly} onChange={e => setReadOnly(e.target.checked)} />Read only</label>
      <label><input type="checkbox" checked={disabled} onChange={e => setDisabled(e.target.checked)} />Disabled</label>
      <div className="surfaces-grid">{Object.keys(tokens).map(role => <div key={role}>
        <label htmlFor={`preview-${role}`}>{role} field</label>
        <input id={`preview-${role}`} type="text" data-input-role={role} aria-invalid={invalid} aria-describedby={`help-${role}`} readOnly={readOnly} disabled={disabled} placeholder="Enter a value" />
        <p id={`help-${role}`}>{invalid ? 'Example error: check this value.' : 'Visible label and help text remain separate from styling.'}</p>
        <pre>{`.field { @ds-input(${role}${tone ? ` ${tone}` : ''}${size ? ` ${size}` : ''}); }`}</pre>
        <details><summary>CSS from the shared engine</summary><pre>{inputComponentCss(theme, '.field', role, tone, size)}</pre><pre>{JSON.stringify(Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith(`--input-${role}-`))), null, 2)}</pre></details>
      </div>)}</div>
    </section>
  </div>
}
