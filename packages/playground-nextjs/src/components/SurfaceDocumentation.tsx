import Link from 'next/link'
import { DEFAULT_SURFACES, SURFACE_PROPERTIES } from 'uxdsl/engine'

// The rules section of /docs/surfaces. The roles and fields are the engine's own.
export function SurfaceRules() {
  const roles = Object.keys(DEFAULT_SURFACES)
  const fields = Object.keys(SURFACE_PROPERTIES)
  return (
    <section className="doc-section" aria-labelledby="surface-rules">
      <h2 id="surface-rules">Rules</h2>
      <ul>
        <li>A surface role composes six fields — {fields.map((field, i) => <span key={field}>{i ? ', ' : ''}<code>{field}</code></span>)} — from the other families. The base roles are {roles.map((role, i) => <span key={role}>{i ? ', ' : ''}<code>{role}</code></span>)}; a project adds its own in <code>surfaces</code>, inheriting <code>contained</code>’s fields.</li>
        <li><code>@ds-surface(role [tone] [size] [radius(k)] [shadow(k)])</code>: a tone (a Palette family with <code>main</code>, <code>dark</code>, <code>contrast</code>) swaps the colors; a size <code>n</code> picks <code>density(n)</code> and <code>radius(n)</code>; <code>radius()</code> and <code>shadow()</code> override one field.</li>
        <li>The directive is a direct child of the rule it styles (<code>UXD_DIRECTIVE_CONTEXT</code> otherwise) and is not itself responsive: put a responsive value on a property, or in the role’s field in the theme.</li>
        <li>A declaration after the directive wins; that is the way to make one component an exception. Changing a field of a role changes every component that names it.</li>
        <li><code>surface</code>, <code>light</code> and <code>dark</code> are canvas colors: use them as a tone only on <code>contained</code> (see <Link href="/docs/accessibility">Accessibility</Link>).</li>
      </ul>
      <pre><code className="language-css">{`.card { @ds-surface(contained); }
.notice { @ds-surface(outlined info 2); }
.hero { @ds-surface(contained primary shadow(3)); }`}</code></pre>
      <pre><code className="language-css">{`.card--flat {
  @ds-surface(contained);
  box-shadow: shadow(0);
}`}</code></pre>
      <pre><code className="language-css">{`.panel { @ds-surface(contained text); }  /* UXD_SURFACE_TONE: text is not a tone */
.panel { @ds-surface(glass); }  /* UXD_SURFACE_REFERENCE: no glass role in the theme */`}</code></pre>
      <p>The guide for coding agents is on <Link href="/docs/for-ai-agents#ai-surfaces-guide">For AI agents</Link>.</p>
    </section>
  )
}
