'use client'

import { useEffect, useMemo, useState } from 'react'
import { generateShadowCss, getShadowTokens, inspectShadowTheme } from 'postcss-uxdsl/ds-runtime'
import { useTheme } from './ThemeContext'

export default function DemoShadows() {
  const { activeThemeData } = useTheme()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [overrides, setOverrides] = useState<Record<string, unknown> | null>(null)
  const [viewport, setViewport] = useState(0)
  const theme = useMemo(() => ({ ...activeThemeData, ...overrides }), [activeThemeData, overrides])
  const tokens = useMemo(() => getShadowTokens(theme), [theme])
  const css = useMemo(() => generateShadowCss(theme, undefined, '#DemoShadows'), [theme])
  const values = useMemo(() => inspectShadowTheme(theme, viewport), [theme, viewport])
  useEffect(() => {
    setOverrides(null)
    setDraft(JSON.stringify({ breakpoints: activeThemeData.breakpoints, shadows: getShadowTokens(activeThemeData) }, null, 2))
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
      generateShadowCss({ ...activeThemeData, ...next })
      setOverrides(next)
      setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
  }
  return <div id="DemoShadows" className="demo-shadows">
    <style>{css}</style>
    <section className="section">
      <h2 className="section-title">Shared engine playground</h2>
      <p>Actual viewport: {viewport}px. Resize the browser to test transitions. The preview uses the active theme and shared engine defaults. Edits below are scoped to this demo and do not save source JSON.</p>
      <label htmlFor="shadow-theme">Shadows and breakpoint configuration</label>
      <textarea id="shadow-theme" value={draft} onChange={e => setDraft(e.target.value)} rows={16} style={{ width: '100%', fontFamily: 'monospace' }} />
      <button type="button" onClick={apply}>Apply preview</button>
      <button type="button" onClick={() => { setOverrides(null); setDraft(JSON.stringify({ breakpoints: activeThemeData.breakpoints, shadows: getShadowTokens(activeThemeData) }, null, 2)); setError('') }}>Reset to active theme</button>
      {error && <p role="alert">{error} The last valid preview remains active.</p>}
    </section>
    <section className="section">
      <h3>Shadow presets</h3>
      <div className="grid">{Object.keys(tokens).map(key => <div key={key} className="card">
        <div className="preview-box" style={{ boxShadow: `var(--uxdsl__shadow__${key})` }}>Shadow {key}</div>
        <pre>{`box-shadow: shadow(${key});`}</pre><code>{values[`--uxdsl__shadow__${key}`]}</code>
      </div>)}</div>
    </section>
  </div>
}
