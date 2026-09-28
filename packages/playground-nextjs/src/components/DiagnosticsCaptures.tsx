'use client'

// MIG-B7-17 (FEAT-009), phase C: real UXD_* diagnostics, and the two value-function aliases.
//
// The diagnostics are what `uxdsl build` printed for each broken source or theme, captured
// by scripts/capture-capabilities.js (and re-checked by `npm test`), which also fails when a
// case stops producing the code it is listed under. The alias section compiles the same
// source both ways at capture time and, on this page, measures two boxes styled with
// elevation()/rounded() and shadow()/radius() in the site's own stylesheet.

import { useEffect, useRef, useState } from 'react'
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

export function AliasComparison() {
  const alias = useRef<HTMLDivElement>(null)
  const name = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState<{ alias: string[]; name: string[] } | null>(null)

  useEffect(() => {
    const read = (el: HTMLDivElement | null) => {
      if (!el) return ['', '']
      const cs = getComputedStyle(el)
      return [cs.boxShadow, cs.borderTopLeftRadius]
    }
    const measure = () => setMeasured({ alias: read(alias.current), name: read(name.current) })
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const same = measured && measured.alias.join('|') === measured.name.join('|')
  return (
    <div className="cap-aliases">
      <div className="cap-grid">
        <figure className="cap-run">
          <figcaption className="cap-run__title">Compiled once each way</figcaption>
          <pre className="cap-terminal"><code>{captures.aliases.source.trimEnd()}</code></pre>
          <pre className="cap-terminal"><code><span className="cap-terminal__prompt">$ uxdsl {captures.aliases.argv.join(' ')}</span>{`\n${captures.aliases.css.trimEnd()}`}</code></pre>
        </figure>
        <div className="cap-alias-demo">
          <div ref={alias} className="cap-alias-box cap-alias-box--alias"><code>elevation(2)</code> · <code>rounded(2)</code></div>
          <div ref={name} className="cap-alias-box cap-alias-box--name"><code>shadow(2)</code> · <code>radius(2)</code></div>
          {measured && (
            <dl className="cap-facts">
              <dt>box-shadow</dt><dd><code>{measured.alias[0]}</code> {measured.alias[0] === measured.name[0] ? '= same' : `≠ ${measured.name[0]}`}</dd>
              <dt>border-radius</dt><dd><code>{measured.alias[1]}</code> {measured.alias[1] === measured.name[1] ? '= same' : `≠ ${measured.name[1]}`}</dd>
            </dl>
          )}
          <p className="cap-note" data-alias-equal={same ? 'true' : 'false'}>{same ? 'Measured in this browser: identical.' : 'Measuring…'}</p>
        </div>
      </div>
    </div>
  )
}
