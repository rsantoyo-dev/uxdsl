'use client'

// MIG-B7-17 (FEAT-009), phase C: the WCAG gate, run on the theme this page is showing.
//
// The same call `uxdsl theme --contrast` makes — checkThemeContrast(resolveTheme(theme),
// { exceptions }) with the exceptions shipped next to the base theme — on ThemeContext's
// active theme, so switching the theme in the header re-runs it. The browser walk
// (fixtures/playground-browser/walk.js) reads the summary this renders and checks it
// against the same call made in Node for the same theme.

import { useMemo, useState } from 'react'
import { checkThemeContrast, resolveTheme } from 'postcss-uxdsl/ds-runtime'
import exceptions from 'postcss-uxdsl/theme/base.contrast-exceptions.json'
import { useTheme } from './ThemeContext'

type Filter = 'all' | 'light' | 'dark'

export default function ContrastReport() {
  const { activeThemeData, currentTheme } = useTheme()
  const [filter, setFilter] = useState<Filter>('all')
  const report = useMemo(() => checkThemeContrast(resolveTheme(activeThemeData), { exceptions: exceptions as never }), [activeThemeData])

  const groups = useMemo(() => {
    const map = new Map<string, number>()
    for (const f of report.failures) map.set(`${f.mode} · ${f.family} · ${f.pair}`, (map.get(`${f.mode} · ${f.family} · ${f.pair}`) || 0) + 1)
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [report])

  const shown = report.failures.filter((f) => filter === 'all' || f.mode === filter)
  const summary = { theme: currentTheme, passed: report.passed, checked: report.checked.length, failures: report.failures.length, exceptions: report.exceptions.length, exceptionIssues: report.exceptionIssues.length }
  const signatures = report.failures.map((f) => `${f.mode}.${f.family}.${f.component}.${f.tone ?? '-'}.${f.state}.${f.pair}.${f.background}.${f.breakpoint}`).sort()

  return (
    <div className="cap-contrast" data-testid="contrast-report" data-contrast-summary={JSON.stringify(summary)} data-contrast-signatures={JSON.stringify(signatures)}>
      <div className="cap-stats">
        <div className="cap-stat"><span className="cap-stat__label">Theme</span><span className="cap-stat__value">{currentTheme}</span></div>
        <div className="cap-stat"><span className="cap-stat__label">Verdict</span><span className={`cap-stat__value ${report.passed ? 'cap-result' : 'cap-result cap-result--error'}`}>{report.passed ? 'passed' : 'fails'}</span></div>
        <div className="cap-stat"><span className="cap-stat__label">Pairs checked</span><span className="cap-stat__value">{report.checked.length}</span></div>
        <div className="cap-stat"><span className="cap-stat__label">Failing pairs</span><span className="cap-stat__value">{report.failures.length}</span></div>
        <div className="cap-stat"><span className="cap-stat__label">Exceptions (matched)</span><span className="cap-stat__value">{report.exceptions.length} ({report.exceptions.filter((e) => e.matched).length})</span></div>
        <div className="cap-stat"><span className="cap-stat__label">Exception issues</span><span className="cap-stat__value">{report.exceptionIssues.length}</span></div>
      </div>
      {report.exceptionIssues.map((issue) => <p key={issue} className="cap-result cap-result--error">{issue}</p>)}

      <div className="cap-table-wrap">
        <table>
          <caption>Failing pairs by mode, family and kind</caption>
          <thead><tr><th>Group</th><th>Failing</th></tr></thead>
          <tbody>{groups.map(([group, n]) => <tr key={group}><td>{group}</td><td>{n}</td></tr>)}</tbody>
        </table>
      </div>

      <fieldset className="cap-filter">
        <legend>Show</legend>
        {(['all', 'light', 'dark'] as Filter[]).map((f) => (
          <label key={f}><input type="radio" name="contrast-mode" value={f} checked={filter === f} onChange={() => setFilter(f)} /> {f}</label>
        ))}
      </fieldset>
      <div className="cap-table-wrap">
        <table>
          <caption>{shown.length} failing pair(s)</caption>
          <thead><tr><th>Mode</th><th>Component</th><th>Tone</th><th>State</th><th>Pair</th><th>Width ≥</th><th>Ratio</th><th>Needs</th></tr></thead>
          <tbody>
            {shown.map((f, i) => (
              <tr key={`${f.mode}-${f.family}-${f.component}-${f.tone}-${f.state}-${f.pair}-${f.background}-${i}`}>
                <td>{f.mode}</td><td><code>{f.family}.{f.component}</code></td><td>{f.tone ?? '—'}</td><td>{f.state}</td><td>{f.pair}</td><td>{f.breakpoint}px</td>
                <td>{f.ratio === null ? 'unresolved' : f.ratio.toFixed(2)}</td><td>{f.required}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
