import Link from 'next/link'
import { TYPOGRAPHY_PROPERTIES } from 'uxdsl/engine'

// The rules section of /docs/typography. The field list is the engine's own.
export default function TypographyRules() {
  const fields = Object.keys(TYPOGRAPHY_PROPERTIES)
  return (
    <section className="doc-section" aria-labelledby="typography-rules">
      <h2 id="typography-rules">Rules</h2>
      <ul>
        <li>A role is a set of fields in <code>typography_details</code>: {fields.map((field, i) => <span key={field}>{i ? ', ' : ''}<code>{field}</code></span>)}. Each is a CSS value or a responsive expression; anything else is <code>UXD_TYPO_FIELD</code>.</li>
        <li><code>default</code> fills the fields a role omits; a role’s own field replaces the default’s whole value, breakpoints included.</li>
        <li><code>@ds-typo(role)</code> emits one declaration per field the theme defines for the role, and nothing else — no reset of <code>text-transform</code> or <code>font-style</code>. An unknown role is <code>UXD_TYPO_REFERENCE</code>; it never falls back to <code>default</code>.</li>
        <li>The directive emits where it is written: a declaration after it wins (<code>{'.eyebrow { @ds-typo(caption); margin: 0; }'}</code> keeps <code>margin: 0</code>).</li>
        <li>Sizes step at breakpoints; they are not fluid. A role is visual: keep heading levels right for the document, whichever role styles them.</li>
        <li>A muted text is a palette color on the component, not an <code>opacity</code> field.</li>
      </ul>
      <pre><code className="language-css">{`.eyebrow { @ds-typo(caption); margin: 0; }
.title { @ds-typo(hero); }  /* UXD_TYPO_REFERENCE: the theme defines no hero role */`}</code></pre>
      <p>The guide for coding agents is on <Link href="/docs/for-ai-agents#ai-typography-guide">For AI agents</Link>.</p>
    </section>
  )
}
