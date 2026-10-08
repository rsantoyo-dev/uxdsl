import Link from 'next/link'
import { BUTTON_PROPERTIES, BUTTON_STATES, DEFAULT_BUTTONS } from 'uxdsl/engine'

// The rules section of /docs/buttons. Roles, fields and states are the engine's own.
export function ButtonRules() {
  const list = (names: string[]) => names.map((name, i) => <span key={name}>{i ? ', ' : ''}<code>{name}</code></span>)
  return (
    <section className="doc-section" aria-labelledby="button-rules">
      <h2 id="button-rules">Rules</h2>
      <ul>
        <li>A button role is a surface plus <code>base</code> overrides and per-state fields. Base roles: {list(Object.keys(DEFAULT_BUTTONS))}. Fields: {list(Object.keys(BUTTON_PROPERTIES))}. States: {list(Object.keys(BUTTON_STATES))}.</li>
        <li><code>selected</code> matches <code>.is-selected</code>, <code>aria-pressed=&quot;true&quot;</code> and <code>aria-selected=&quot;true&quot;</code>; <code>disabled</code> matches <code>:disabled</code> and <code>aria-disabled=&quot;true&quot;</code>, and <code>hover</code>/<code>active</code> exclude a disabled control. Styling is not behavior: <code>aria-disabled</code> does not stop a click.</li>
        <li>The base roles ship <code>hover</code>, <code>focusvisible</code> (a 2px outline in the tone), <code>selected</code> and <code>disabled</code>; <code>active</code> and <code>focus</code> are yours to add.</li>
        <li>In a role’s value, <code>tone(main | dark | contrast)</code> follows the tone the component asks for; an explicit <code>palette(primary.dark)</code> keeps its meaning whatever the tone.</li>
        <li>One <code>@ds-button</code> or <code>@ds-input</code> per rule (<code>UXD_DIRECTIVE_DUPLICATE</code>). An unknown role is <code>UXD_BUTTON_ROLE</code>, an unknown state <code>UXD_BUTTON_STATE</code>.</li>
        <li>New values apply at run time; a new state or another surface is a structural change — rebuild (<Link href="/docs/runtime">Runtime</Link>).</li>
      </ul>
      <pre><code className="language-css">{`.save { @ds-button(contained success); }
.save--quiet { @ds-button(outlined success 2); }
.save--round { @ds-button(contained radius(pill)); }`}</code></pre>
      <pre><code className="language-css">{`.buy { @ds-button(checkout); }  /* UXD_BUTTON_ROLE: the theme defines no checkout role */
.cta { @ds-button(contained); @ds-button(outlined); }  /* UXD_DIRECTIVE_DUPLICATE: one control directive per rule */`}</code></pre>
      <p>The guide for coding agents is on <Link href="/docs/for-ai-agents#ai-buttons-guide">For AI agents</Link>.</p>
    </section>
  )
}
