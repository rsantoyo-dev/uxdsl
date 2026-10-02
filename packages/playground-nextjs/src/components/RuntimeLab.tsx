'use client'

// MIG-B7-17 (FEAT-009), phase C: the runtime API, called for real.
//
// Two halves, on purpose:
//   - "This site": read-only calls against the page you are on — getAppliedTheme,
//     subscribeTheme, and the computed custom property the applied stylesheet produced. They
//     observe what ThemeContext applied; they change nothing.
//   - "Sandbox": every call that changes state runs in an iframe with its own document and
//     its own copy of the runtime (src/runtime-sandbox/sandbox-entry.ts). Run on this page,
//     resetTheme would restore the theme ThemeContext initialized with behind its back.
//     Reloading the sandbox undoes everything it did.

import { useCallback, useEffect, useRef, useState } from 'react'
import { getAppliedTheme, subscribeTheme } from 'postcss-uxdsl/ds-runtime'
import type { UxdslLab } from '@/runtime-sandbox/sandbox-entry'
import { useTheme } from './ThemeContext'

type SiteEntry = { n: number; primary: string; families: number }

export function SiteThemeState() {
  const { currentTheme, isDark } = useTheme()
  const [applied, setApplied] = useState<{ primary: string; families: string[] }>({ primary: '', families: [] })
  const [computed, setComputed] = useState('')
  const [entries, setEntries] = useState<SiteEntry[]>([])
  const counter = useRef(0)

  const read = useCallback(() => {
    const override = getAppliedTheme()
    setApplied({ primary: override?.palette?.primary?.main ?? '(not set by the override)', families: Object.keys(override) })
    setComputed(getComputedStyle(document.documentElement).getPropertyValue('--uxdsl__palette__primary-main').trim())
  }, [])

  useEffect(() => {
    read()
    const unsubscribe = subscribeTheme((override) => {
      counter.current += 1
      const n = counter.current
      setEntries((list) => [{ n, primary: override?.palette?.primary?.main ?? '—', families: Object.keys(override).length }, ...list].slice(0, 8))
      read()
    })
    return unsubscribe
  }, [read])

  // Dark mode is a data-theme attribute, not a theme application: re-read on toggle.
  useEffect(() => { read() }, [isDark, read])

  return (
    <div className="cap-card" data-testid="site-theme-state">
      <h3 className="cap-card__title">This site, right now</h3>
      <dl className="cap-facts">
        <dt>Theme selected in the header</dt><dd><code>{currentTheme}</code></dd>
        <dt><code>getAppliedTheme()</code> — families in the applied override</dt><dd>{applied.families.length ? applied.families.join(', ') : '{} (not initialized yet)'}</dd>
        <dt><code>getAppliedTheme().palette.primary.main</code></dt><dd><code>{applied.primary}</code></dd>
        <dt><code>getComputedStyle(document.documentElement).getPropertyValue(&apos;--uxdsl__palette__primary-main&apos;)</code> — the computed custom property</dt><dd><code>{computed}</code></dd>
      </dl>
      <p className="cap-note">The two can differ: the override holds the light value, and in dark mode the stylesheet{' '}
        <code>applyTheme</code> generated switches <code>primary-main</code> to <code>modes.dark</code>&apos;s — which is what{' '}
        the computed style reads.</p>
      <h4 className="cap-card__subtitle"><code>subscribeTheme(listener)</code></h4>
      {entries.length === 0
        ? <p className="cap-note">No application yet since this page loaded. Switch the theme in the header: each successful <code>applyTheme</code> notifies this listener.</p>
        : <ol className="cap-log" reversed>{entries.map((e) => <li key={e.n}>application #{e.n}: <code>palette.primary.main = {e.primary}</code>, {e.families} families</li>)}</ol>}
      <button type="button" className="cap-button" onClick={read}>Read again</button>
    </div>
  )
}

type Step = { group: string; call: string; note: string; run: (lab: UxdslLab) => unknown }

const KEY = 'LAB_KEY'
// The values the steps patch in. They are theme data handed to the runtime, not styling of
// this page — which is why they are literals (the ratchet counts them; see capability-evidence.json).
const TEAL = '#0f766e'
const AMBER = '#fde68a'
const STEPS: Step[] = [
  { group: 'Theme API', call: `loadPersistedTheme({ key: ${KEY} })`, note: 'Before the project theme was applied once: refused, nothing moves.', run: (lab) => lab.api.loadPersistedTheme({ key: lab.storageKey }) },
  { group: 'Theme API', call: `applyTheme(projectOverride, { replace: true, styleId: 'uxdsl-lab-theme' })`, note: 'Initialize with the override the sandbox was compiled with (this site\'s default theme).', run: (lab) => lab.api.applyTheme(lab.projectOverride, { replace: true, styleId: 'uxdsl-lab-theme' }) },
  { group: 'Theme API', call: `applyTheme({ palette: { primary: { main: '${TEAL}' } } }, { persist: ${KEY} })`, note: 'A value change: applied, and saved under the lab\'s own key.', run: (lab) => lab.api.applyTheme({ palette: { primary: { main: TEAL } } }, { persist: lab.storageKey }) },
  { group: 'Theme API', call: `applyTheme({ breakpoints: { md: 900 } })`, note: 'Moving a threshold changes what the compiler emitted: refused with UXD_THEME_STRUCTURE.', run: (lab) => lab.api.applyTheme({ breakpoints: { md: 900 } }) },
  { group: 'Theme API', call: 'resetTheme()', note: 'Back to the override it was initialized with — not the packaged base.', run: (lab) => lab.api.resetTheme() },
  { group: 'Theme API', call: `loadPersistedTheme({ key: ${KEY} })`, note: 'The saved override comes back, validated like any patch.', run: (lab) => lab.api.loadPersistedTheme({ key: lab.storageKey }) },
  { group: 'Theme API', call: 'getAppliedTheme()', note: 'What is applied now, as a copy.', run: (lab) => { const t = lab.api.getAppliedTheme(); return { families: Object.keys(t).length, 'palette.primary.main': t?.palette?.primary?.main } } },
  { group: 'Theme API', call: `resetTheme({ clearPersist: true, key: ${KEY} })`, note: 'Reset and forget the saved override.', run: (lab) => lab.api.resetTheme({ clearPersist: true, key: lab.storageKey }) },
  { group: 'One token at a time — still applyTheme', call: `applyTheme({ colors: { gray: { 300: '${AMBER}' } } })`, note: 'A Color token: only color(gray-300) consumers follow. Where updateColor used to write an inline property, this replaces the custom property in the managed stylesheet.', run: (lab) => lab.api.applyTheme({ colors: { gray: { 300: AMBER } } }) },
  { group: 'One token at a time — still applyTheme', call: `applyTheme({ spacing: { 5: '2rem' } })`, note: 'density(4) is space(5) at this width, so the Density box grows; the space(4) box does not.', run: (lab) => lab.api.applyTheme({ spacing: { 5: '2rem' } }) },
]

type LogItem = { n: number; call: string; outcome: string; ok: boolean; events: string[]; after: string }

function describe(value: unknown): { ok: boolean; text: string } {
  if (value && typeof value === 'object' && 'ok' in (value as Record<string, unknown>)) {
    const result = value as { ok: boolean; error?: Error; warnings?: string[] }
    if (result.ok) return { ok: true, text: `{ ok: true${result.warnings?.length ? `, warnings: ${result.warnings.length}` : ''} }` }
    return { ok: false, text: `{ ok: false } — ${result.error?.message.split('\n')[0]}` }
  }
  if (value === undefined) return { ok: true, text: 'undefined (returns nothing)' }
  return { ok: true, text: JSON.stringify(value) }
}

type Probe = ReturnType<UxdslLab['probe']>

export function RuntimeSandbox() {
  const frame = useRef<HTMLIFrameElement>(null)
  const [lab, setLab] = useState<UxdslLab | null>(null)
  const [probe, setProbe] = useState<Probe | null>(null)
  const [log, setLog] = useState<LogItem[]>([])
  const counter = useRef(0)

  const onLoad = () => {
    const found = frame.current?.contentWindow?.__uxdslLab ?? null
    setLab(found)
    setLog([])
    counter.current = 0
    if (found) { found.drainEvents(); setProbe(found.probe()) }
  }

  const runStep = (step: Step) => {
    if (!lab) return
    let value: unknown
    try { value = step.run(lab) } catch (error) { value = { ok: false, error } }
    const { ok, text } = describe(value)
    counter.current += 1
    const n = counter.current
    const events = lab.drainEvents().map((e) => `${e.source}: ${e.detail}`)
    const p = lab.probe()
    const after = `after: primary-main ${p.primaryMain} · space(4)/density(4) ${p.spacePadding}/${p.densityPadding} · layout ${p.layoutDirection} · md ${p.appliedMd ?? '—'} (applied)`
    setLog((list) => [...list, { n, call: step.call, outcome: text, ok, events, after }])
    setProbe(p)
  }

  const groups = Array.from(new Set(STEPS.map((s) => s.group)))

  return (
    <div className="cap-sandbox" data-testid="runtime-sandbox">
      <div className="cap-frame-wrap">
        <iframe ref={frame} className="cap-frame" src="/runtime-sandbox/index.html" title="UXDSL runtime sandbox: a compiled page with its own copy of the runtime" onLoad={onLoad} />
      </div>
      <div className="cap-sandbox__controls">
        {groups.map((group) => (
          <div key={group} className="cap-card">
            <h3 className="cap-card__title">{group}</h3>
            <ol className="cap-steps">
              {STEPS.filter((s) => s.group === group).map((step) => (
                <li key={step.call + step.note}>
                  <button type="button" className="cap-button" disabled={!lab} onClick={() => runStep(step)}><code>{step.call}</code></button>
                  <span className="cap-note">{step.note}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
        <button type="button" className="cap-button cap-button--reset" onClick={() => frame.current?.contentWindow?.location.reload()}>Reload the sandbox (undo everything)</button>
      </div>
      <div className="cap-card">
        <h3 className="cap-card__title">What the sandbox reports</h3>
        {probe && (
          <dl className="cap-facts">
            <dt>Sandbox width</dt><dd>{probe.width}px</dd>
            <dt>Computed <code>--uxdsl__palette__primary-main</code></dt><dd><code>{probe.primaryMain}</code></dd>
            <dt><code>palette(primary-main)</code> swatch</dt><dd><code>{probe.paletteSwatch}</code></dd>
            <dt><code>color(gray-300)</code> swatch</dt><dd><code>{probe.colorSwatch}</code></dd>
            <dt><code>space(4)</code> / <code>density(4)</code> padding</dt><dd><code>{probe.spacePadding}</code> / <code>{probe.densityPadding}</code></dd>
            <dt>Layout <code>flex-direction</code></dt><dd><code>{probe.layoutDirection}</code></dd>
            <dt><code>getAppliedTheme().breakpoints.md</code></dt><dd><code>{probe.appliedMd ?? '—'}</code></dd>
          </dl>
        )}
        <h4 className="cap-card__subtitle">Calls, results, and what <code>subscribeTheme</code> heard</h4>
        {log.length === 0 ? <p className="cap-note">Run a step. Each call&apos;s return value is shown as it came back.</p> : (
          <ol className="cap-log">
            {log.map((item) => (
              <li key={item.n} className={item.ok ? '' : 'is-invalid'}>
                <code>{item.call}</code> → <span className={item.ok ? 'cap-result' : 'cap-result cap-result--error'}>{item.outcome}</span>
                {item.events.map((e) => <div key={e} className="cap-event">{e}</div>)}
                <div className="cap-event">{item.after}</div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
