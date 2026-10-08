'use client'

// Real UXD_* diagnostics: what `uxdsl build` printed for each broken source or theme,
// captured by scripts/capture-capabilities.js (and re-checked by `npm test`), which also
// fails when a case stops producing the code it is listed under. The catalog table is the
// package's own DIAGNOSTIC_CATALOG, rendered as is: every code, its meaning and its fix.

import captures from '@/generated/compiler-captures.json'
import { DIAGNOSTIC_CATALOG } from 'uxdsl/language'

type Diagnostic = { code: string; title: string; source: string; theme: unknown; argv: string[]; exit: number; stderr: string }

export function DiagnosticsList() {
  const list = captures.diagnostics as Diagnostic[]
  return (
    <div className="cap-grid">
      {list.map((d) => (
        <figure key={d.code} id={`capture-${d.code.toLowerCase()}`} className="cap-run" data-diagnostic={d.code}>
          <figcaption className="cap-run__title"><code>{d.code}</code> — {d.title}</figcaption>
          {d.theme ? (<>
            <p className="cap-note"><code>uxdsl.theme.json</code></p>
            <pre className="cap-terminal"><code>{JSON.stringify(d.theme, null, 2)}</code></pre>
          </>) : null}
          <p className="cap-note"><code>src/example.uxdsl</code></p>
          <pre className="cap-terminal"><code>{d.source.trimEnd()}</code></pre>
          <pre className="cap-terminal"><code><span className="cap-terminal__prompt">$ uxdsl {d.argv.join(' ')}</span><span className="cap-terminal__err">{`\n${d.stderr.trimEnd()}`}</span></code></pre>
        </figure>
      ))}
    </div>
  )
}

const OWNERS: Array<[string, string]> = [
  ['compiler', 'The compiler (your stylesheet)'],
  ['theme', 'The theme (validateTheme and the engines, build and run time alike)'],
  ['runtime', 'The browser runtime (returned on a result, never thrown)'],
  ['core', 'uxdsl-core (the SCSS subset and imports)'],
]

export function DiagnosticsCatalog() {
  const entries = Object.entries(DIAGNOSTIC_CATALOG).sort(([a], [b]) => a.localeCompare(b))
  const captured = new Set((captures.diagnostics as Diagnostic[]).map((d) => d.code))
  return (
    <div data-testid="diagnostics-catalog">
      {OWNERS.map(([owner, title]) => {
        const rows = entries.filter(([, entry]) => entry.owner === owner)
        return (
          <div key={owner} className="cap-table-wrap">
            <table>
              <caption>{title} — {rows.length} codes</caption>
              <thead><tr><th>Code</th><th>Meaning</th><th>Fix</th></tr></thead>
              <tbody>{rows.map(([code, entry]) => (
                <tr key={code} id={code.toLowerCase()} data-code={code}>
                  <td><code>{code}</code>{captured.has(code) ? <> <a href={`#capture-${code.toLowerCase()}`}>example</a></> : null}</td>
                  <td>{entry.meaning}</td>
                  <td>{entry.fix}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
