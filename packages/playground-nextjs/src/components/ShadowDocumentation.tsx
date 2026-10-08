import Link from 'next/link'

// The rules section of /docs/shadows.
export default function ShadowRules() {
  return (
    <section className="doc-section" aria-labelledby="shadow-rules">
      <h2 id="shadow-rules">Rules</h2>
      <ul>
        <li><code>shadow(k)</code> names a <code>box-shadow</code> preset. A key is a name, not a strength or a z-index; it does not change stacking order.</li>
        <li>A preset may have several comma-separated layers, <code>inset</code>, and token references; it may be responsive, with a base value. The value steps at breakpoints.</li>
        <li><code>shadow(0)</code> is <code>none</code> and stays a token; a local <code>box-shadow: none</code> removes the effect for one component on purpose.</li>
        <li>An unknown key is <code>UXD_SHADOW_REFERENCE</code>; a second argument is <code>UXD_SHADOW_ARGUMENT</code>; the former <code>elevation()</code> alias is <code>UXD_SYNTAX_REMOVED</code>.</li>
        <li>For one component choose another preset; to soften every card, change the preset in the theme. A box-shadow preset is not necessarily valid as a <code>text-shadow</code> or <code>drop-shadow()</code>.</li>
      </ul>
      <pre><code className="language-css">{`.card { box-shadow: shadow(2); }
.card:hover { box-shadow: shadow(4); }
.card { box-shadow: shadow(9); }  /* UXD_SHADOW_REFERENCE: no shadow 9 in the theme */`}</code></pre>
      <p>The guide for coding agents is on <Link href="/docs/for-ai-agents#ai-shadows-guide">For AI agents</Link>.</p>
    </section>
  )
}
