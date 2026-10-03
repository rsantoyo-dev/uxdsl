'use client'

// Real UXD_* diagnostics: what `uxdsl build` printed for each broken source or theme,
// captured by scripts/capture-capabilities.js (and re-checked by `npm test`), which also
// fails when a case stops producing the code it is listed under.

import captures from '@/generated/compiler-captures.json'

type Diagnostic = { code: string; title: string; source: string; theme: unknown; argv: string[]; exit: number; stderr: string }

export function DiagnosticsList() {
  const list = captures.diagnostics as Diagnostic[]
  return (
    <div className="cap-grid">
      {list.map((d) => (
        <figure key={d.code} className="cap-run" data-diagnostic={d.code}>
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
