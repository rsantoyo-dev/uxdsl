'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { generateDensityCss, inspectResponsiveValue } from 'postcss-uxdsl/language'
import type { Breakpoints } from './BreakpointsProvider'
import styles from './DensitySimulator.module.css'

// No scripts or user-supplied HTML are injected into the isolated preview.
const FRAME_DOCUMENT = '<!doctype html><html lang="en"><head><meta charset="utf-8"><style>html{font:16px system-ui;background:#f4f7fb;color:#142338}body{margin:0;padding:20px}*{box-sizing:border-box}.examples{display:flex;flex-wrap:wrap;gap:16px}.sample{flex:1 1 200px;min-width:0;padding:var(--demo-density);background:white;border:1px solid #a9bed5;border-radius:12px;overflow-wrap:anywhere}.sample h3{margin:0 0 12px}.stack{display:flex;flex-direction:column;gap:var(--demo-density)}.field{padding:8px;border:1px solid #a9bed5;border-radius:6px}.rings{position:relative;margin:16px 0;padding:var(--demo-density);outline:2px solid #286ca8;background:#d5eaff}.rings span{display:block;position:relative;border:1px dashed #286ca8;padding:12px;text-align:center;background:white}.fixed{padding:var(--space-4);margin:16px 0;border:1px dashed #687c94}code{font-size:13px}p{line-height:1.5}</style></head><body></body></html>'

export default function DensitySimulator({ definitions, breakpoints, level, onEdit }: {
  definitions: Record<number, string>;
  breakpoints: Breakpoints;
  level: number;
  onEdit: () => void;
}) {
  const host = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [doc, setDoc] = useState<Document | null>(null)
  const [mode, setMode] = useState('auto')
  const [manualWidth, setManualWidth] = useState(768)
  const [autoWidth, setAutoWidth] = useState(640)
  const [measured, setMeasured] = useState({ width: 0, padding: '—', fixed: '—' })
  const [spacingCss, setSpacingCss] = useState('')
  const entries = Object.entries(breakpoints).filter(([, px]) => Number.isFinite(px) && px >= 0).sort((a, b) => a[1] - b[1])
  const maxWidth = Math.max(1920, ...entries.map(([, px]) => px + 160))
  const firstWidth = Math.max(1, Math.min(375, (entries[1]?.[1] ?? 640) - 1))
  const selectedWidth = mode === 'auto' ? autoWidth : mode === 'custom' ? manualWidth : mode === entries[0]?.[0] ? firstWidth : Math.max(1, breakpoints[mode] ?? manualWidth)
  const width = Math.max(1, Math.round(selectedWidth))
  const inspected = inspectResponsiveValue(definitions[level], measured.width, breakpoints)
  const densityCss = generateDensityCss(definitions, breakpoints)

  useEffect(() => {
    if (!host.current) return
    const observer = new ResizeObserver(([entry]) => setAutoWidth(Math.max(1, Math.floor(entry.contentRect.width))))
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [])

  // CSS custom properties do not inherit across an iframe boundary. Copy the
  // active spacing variables only, then let real iframe media queries resolve Density.
  useEffect(() => {
    const sync = () => {
      const computed = getComputedStyle(document.documentElement)
      const declarations: string[] = []
      for (let i = 0; i < computed.length; i++) {
        const name = computed[i]
        if (/^--space-[\w-]+$/.test(name)) declarations.push(`${name}:${computed.getPropertyValue(name)};`)
      }
      setSpacingCss(`:root{${declarations.join('')}}`)
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true })
    observer.observe(document.head, { childList: true, subtree: true, characterData: true, attributes: true })
    window.addEventListener('resize', sync)
    // Also covers CSSOM updates that do not generate MutationObserver records.
    const timer = window.setInterval(sync, 500)
    return () => { observer.disconnect(); clearInterval(timer); window.removeEventListener('resize', sync) }
  }, [])

  useEffect(() => {
    const win = doc?.defaultView
    if (!doc || !win) return
    const measure = () => {
      const sample = doc.querySelector('.sample')
      const fixed = doc.querySelector('.fixed')
      if (sample && fixed) setMeasured({ width: win.innerWidth, padding: win.getComputedStyle(sample).paddingTop, fixed: win.getComputedStyle(fixed).paddingTop })
    }
    const id = win.requestAnimationFrame(measure)
    win.addEventListener('resize', measure)
    return () => { win.cancelAnimationFrame(id); win.removeEventListener('resize', measure) }
  }, [doc, width, level, densityCss, spacingCss])

  return <section className={styles.simulator} aria-labelledby="density-simulator-title">
    <h3 id="density-simulator-title">Try a real responsive viewport</h3>
    <p>Keep the token unchanged and resize its viewport. Then edit its mapping to update every connected example. These are real media queries inside an isolated iframe—not a simulated CSS value.</p>
    <div className={styles.controls} role="group" aria-label="Preview breakpoint">
      <button type="button" aria-pressed={mode === 'auto'} onClick={() => setMode('auto')}>Auto</button>
      {entries.map(([bp, px]) => <button type="button" key={bp} aria-pressed={mode === bp} onClick={() => setMode(bp)}>{bp} · {px}px+</button>)}
    </div>
    <label className={styles.slider}>Viewport width
      <input type="range" min={1} max={maxWidth} value={Math.min(width, maxWidth)} onChange={e => { setMode('custom'); setManualWidth(Number(e.target.value)) }} />
      <input aria-label="Exact viewport width in pixels" type="number" min={1} max={maxWidth} value={width} onChange={e => { setMode('custom'); setManualWidth(Math.max(1, Math.min(maxWidth, Number(e.target.value) || 1))) }} /> px
    </label>
    <dl className={styles.metrics} aria-live="polite">
      <div><dt>Actual viewport</dt><dd>{measured.width}px</dd></div>
      <div><dt>Current breakpoint</dt><dd>{inspected.active ?? '—'}</dd></div>
      <div><dt>Applied token rule</dt><dd>{inspected.applied ?? 'Static'}{inspected.applied && inspected.applied !== inspected.active ? ' (inherited)' : ''}</dd></div>
      <div><dt>Computed padding</dt><dd>{measured.padding}</dd></div>
    </dl>
    <p><code>density({level}) → {inspected.value || 'no matching rule'} → {measured.padding}</code></p>
    <button type="button" onClick={onEdit}>Edit density({level}) mapping</button>
    <p><code>{definitions[level]}</code></p>
    <p className={styles.note}>Auto fits the available documentation width. Breakpoint buttons use your current theme thresholds. If a token skips a breakpoint, its previous rule continues to apply. Wide previews scroll horizontally; they are not scaled down.</p>
    <div ref={host} className={styles.viewport}>
      <iframe ref={frame} title="Density responsive viewport: connected card, form and fixed spacing comparison" sandbox="allow-same-origin" srcDoc={FRAME_DOCUMENT} onLoad={() => setDoc(frame.current?.contentDocument ?? null)} style={{ width, height: 650 }} />
    </div>
    {doc && createPortal(<>
      <style>{spacingCss + '\n' + densityCss + `\n:root{--demo-density:var(--density-${level});}`}</style>
      <h2>One token, connected examples</h2>
      <p><code>padding: density({level}); gap: density({level});</code></p>
      <div className="rings"><span>Content — the surrounding space uses density({level})</span></div>
      <div className="examples">
        <article className="sample"><h3>Card</h3><p>The same Density token controls this padding.</p></article>
        <section className="sample"><h3>Form layout</h3><div className="stack"><div className="field">Name field</div><div className="field">Email field</div></div></section>
      </div>
      <div className="fixed"><strong>Fixed comparison: space(4)</strong><p>This stays at the same spacing value across preview breakpoints. Editing the base spacing token can still change it.</p></div>
    </>, doc.body)}
    <p className={styles.note}>Fixed comparison: <code>space(4) → {measured.fixed}</code>. The token cards below report the main page’s breakpoint; this panel reports its own iframe viewport. Container queries are a different context and are not used in this demo.</p>
  </section>
}
