'use client'

import { useEffect, useMemo, useState } from 'react'
import { generateEdgeCss, getEdgeTokens, inspectEdgeTheme, RADIUS_KEYWORDS } from 'postcss-uxdsl/ds-runtime'
import { useTheme } from './ThemeContext'

export default function DemoBorders() {
  const { activeThemeData } = useTheme()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [overrides, setOverrides] = useState<Record<string, unknown> | null>(null)
  const [viewport, setViewport] = useState(0)
  const theme = useMemo(() => ({ ...activeThemeData, ...overrides }), [activeThemeData, overrides])
  const tokens = useMemo(() => getEdgeTokens(theme), [theme])
  const css = useMemo(() => generateEdgeCss(theme, undefined, '#DemoBorders'), [theme])
  const values = useMemo(() => inspectEdgeTheme(theme, viewport), [theme, viewport])
  useEffect(() => {
    setOverrides(null)
    setDraft(JSON.stringify({ breakpoints: activeThemeData.breakpoints, ...getEdgeTokens(activeThemeData) }, null, 2))
    setError('')
  }, [activeThemeData])
  useEffect(() => {
    const update = () => setViewport(window.innerWidth)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  function apply() {
    try {
      const next = JSON.parse(draft)
      if (!next || typeof next !== 'object' || Array.isArray(next)) throw new Error('Expected a theme object.')
      generateEdgeCss({ ...activeThemeData, ...next })
      setOverrides(next)
      setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
  }
  return <div id="DemoBorders" className="demo-borders">
    <style>{css}</style>
    <section className="section">
      <h2 className="section-title">Shared engine playground</h2>
      <p>Actual viewport: {viewport}px. Resize the browser to test transitions. The preview uses the active theme and shared engine defaults. Edits below are scoped to this demo and do not save source JSON.</p>
      <label htmlFor="edge-theme">Borders, Radii and breakpoint configuration</label>
      <textarea id="edge-theme" value={draft} onChange={e => setDraft(e.target.value)} rows={16} style={{ width: '100%', fontFamily: 'monospace' }} />
      <button type="button" onClick={apply}>Apply preview</button>
      <button type="button" onClick={() => { setOverrides(null); setDraft(JSON.stringify({ breakpoints: activeThemeData.breakpoints, ...getEdgeTokens(activeThemeData) }, null, 2)); setError('') }}>Reset to active theme</button>
      {error && <p role="alert">{error} The last valid preview remains active.</p>}
    </section>
    <section className="section">
      <h3>Border presets</h3>
      <div className="grid">{Object.keys(tokens.borders).map(key => <div key={key} className="card">
        <div className="preview-box" style={{ border: `var(--border-${key})`, borderRadius: 'var(--radius-2)' }}>Border {key}</div>
        <pre>{`border: border(${key});`}</pre><code>{values[`--border-${key}`]}</code>
      </div>)}</div>
      <h3>Radius presets</h3>
      <div className="grid">{Object.keys(tokens.radii).map(key => <div key={key} className="card">
        <div className="preview-box" style={{ border: 'var(--border-1)', borderRadius: `var(--radius-${key})` }}>Radius {key}</div>
        <pre>{`border-radius: radius(${key});`}</pre><code>{values[`--radius-${key}`]}</code>
      </div>)}</div>
      <h3>Built-in shapes</h3>
      <div className="grid">{Object.entries(RADIUS_KEYWORDS).map(([key, value]) => <div key={key} className="card"><div className="preview-box" style={{ border: 'var(--border-1)', borderRadius: value }}>{key}</div><code>{`radius(${key}) → ${value}`}</code></div>)}</div>
    </section>
  </div>
}
