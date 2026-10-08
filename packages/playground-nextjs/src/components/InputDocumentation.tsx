import Link from 'next/link'
import { INPUT_PROPERTIES, INPUT_STATES, DEFAULT_INPUTS } from 'uxdsl/engine'

// The rules section of /docs/inputs. Roles, fields and states are the engine's own.
export function InputRules() {
  const list = (names: string[]) => names.map((name, i) => <span key={name}>{i ? ', ' : ''}<code>{name}</code></span>)
  return (
    <section className="doc-section" aria-labelledby="input-rules">
      <h2 id="input-rules">Rules</h2>
      <ul>
        <li>An input role is a surface plus <code>base</code> overrides and per-state fields. Base roles: {list(Object.keys(DEFAULT_INPUTS))}. Fields: {list(Object.keys(INPUT_PROPERTIES))}. States: {list(Object.keys(INPUT_STATES))}.</li>
        <li><code>placeholder</code> emits its own <code>::placeholder</code> rule, in states too; <code>underline</code> is the bottom border, and the <code>underline</code> role clears the others.</li>
        <li><code>invalid</code> matches <code>:invalid</code> and <code>aria-invalid=&quot;true&quot;</code> — styling, not validation; native <code>:invalid</code> can match before the user types. A placeholder is not a label: keep a <code>&lt;label&gt;</code>.</li>
        <li>For text-like inputs and textareas: the role sets <code>width: 100%</code>, <code>box-sizing: border-box</code> and inherits the font. Do not apply it to checkboxes, radios, ranges or file inputs.</li>
        <li>A tone recolors the surface, the caret and the focus border when the theme has that Palette family; an explicit value stays explicit, and <code>invalid</code> keeps the error role.</li>
      </ul>
      <pre><code className="language-css">{`.email { @ds-input(outlined); }
.search { @ds-input(contained info 2); }
.code { @ds-input(underline); font-family: var(--uxdsl__font__code), monospace; }`}</code></pre>
      <p>The guide for coding agents is on <Link href="/docs/for-ai-agents#ai-inputs-guide">For AI agents</Link>.</p>
    </section>
  )
}
