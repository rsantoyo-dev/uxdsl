'use client'

import { useEffect, useMemo, useState } from 'react'
import { generateSurfaceCss, getSurfaceTokens, inspectSurfaceTheme, surfaceDeclarations, generateEdgeCss, generateShadowCss } from 'postcss-uxdsl/ds-runtime'
import { useTheme } from './ThemeContext'

export default function DemoSurfaces() {
  const { activeThemeData } = useTheme()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [tone, setTone] = useState('')
  const [overrides, setOverrides] = useState<Record<string, unknown> | null>(null)
  const [viewport, setViewport] = useState(0)
  const theme = useMemo(() => ({ ...activeThemeData, ...overrides }), [activeThemeData, overrides])
  const tokens = useMemo(() => getSurfaceTokens(theme), [theme])
  const css = useMemo(() => [generateEdgeCss(theme, undefined, '#DemoSurfaces'), generateShadowCss(theme, undefined, '#DemoSurfaces'), generateSurfaceCss(theme, undefined, '#DemoSurfaces')].join('\n'), [theme])
  const values = useMemo(() => inspectSurfaceTheme(theme, viewport), [theme, viewport])
  useEffect(() => {
    setOverrides(null)
    setDraft(JSON.stringify({ breakpoints: activeThemeData.breakpoints, surfaces: getSurfaceTokens(activeThemeData) }, null, 2))
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
      generateSurfaceCss({ ...activeThemeData, ...next })
      generateEdgeCss({ ...activeThemeData, ...next })
      generateShadowCss({ ...activeThemeData, ...next })
      setOverrides(next)
      setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
  }
  return <div id="DemoSurfaces" className="surfaces-section demo-section">
    <style>{css}</style>
    <section className="section">
      <h2 className="section-title">Shared engine playground</h2>
      <p>Actual viewport: {viewport}px. Resize the browser to test transitions. The preview uses the active theme and shared engine defaults. Edits below are scoped to this demo and do not save source JSON.</p>
      <label htmlFor="surface-theme">Surfaces and breakpoint configuration</label>
      <textarea id="surface-theme" value={draft} onChange={e => setDraft(e.target.value)} rows={16} style={{ width: '100%', fontFamily: 'monospace' }} />
      <button type="button" onClick={apply}>Apply preview</button>
      <button type="button" onClick={() => { setOverrides(null); setDraft(JSON.stringify({ breakpoints: activeThemeData.breakpoints, surfaces: getSurfaceTokens(activeThemeData) }, null, 2)); setError('') }}>Reset to active theme</button>
      {error && <p role="alert">{error} The last valid preview remains active.</p>}
    </section>
    <section className="section">
      <label htmlFor="surface-tone">Palette tone (optional)</label>
      <select id="surface-tone" value={tone} onChange={e => setTone(e.target.value)}>
        <option value="">Use configured Surface colors</option>
        {Object.keys(activeThemeData.palette || {}).filter(key => /^[a-z][a-z0-9-]*$/.test(key) && typeof activeThemeData.palette[key] === 'object').map(key => <option key={key} value={key}>{key}</option>)}
      </select>
      <h3>Surface presets</h3>
      <div className="surfaces-grid">{Object.keys(tokens).map(key => {
        const declarations = surfaceDeclarations(theme, key, tone)
        const style = Object.fromEntries(Object.entries(declarations).map(([property, value]) => [property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()), value]))
        return <div key={key} className="surface-example">
          <div className="surface-preview" data-surface-role={key} style={style}>
            <h4>{key}</h4><p>A shared container treatment.</p>
          </div>
          <pre>{`.card { @ds-surface(${key}${tone ? ` ${tone}` : ''}); }`}</pre>
          <details><summary>Resolved preset references</summary><pre>{JSON.stringify(Object.fromEntries(Object.entries(values).filter(([name]) => name.startsWith(`--surface-${key}-`))), null, 2)}</pre></details>
        </div>
      })}</div>
    </section>
  </div>
}
