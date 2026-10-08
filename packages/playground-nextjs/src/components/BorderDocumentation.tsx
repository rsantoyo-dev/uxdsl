import Link from 'next/link'

// The rules section of /docs/borders.
export default function BorderRules() {
  return (
    <section className="doc-section" aria-labelledby="border-rules">
      <h2 id="border-rules">Rules</h2>
      <ul>
        <li><code>border(k)</code> is a whole edge — width, style and color — and <code>radius(k)</code> a corner. Either preset can be static or a responsive expression; the component names it once.</li>
        <li><code>border()</code> takes the key only: <code>border(1, red, dashed)</code> is <code>UXD_EDGE_ARGUMENT</code>. For one component, write <code>border: border(1)</code> and then the longhand you change (<code>border-style: dashed</code>); it persists across the preset’s breakpoints.</li>
        <li><code>radius(pill)</code> is <code>9999px</code> and <code>radius(circle)</code> is <code>50%</code> (a circle needs equal width and height). They are built in, not presets; <code>radius(full)</code> and <code>rounded()</code> are <code>UXD_SYNTAX_REMOVED</code>.</li>
        <li>Every numbered family has an explicit zero: <code>border(0)</code> is <code>none</code>, <code>radius(0)</code> a square corner. An unknown key is <code>UXD_EDGE_REFERENCE</code>, listing the keys that exist.</li>
        <li>A preset can reference the theme: <code>&quot;1px solid palette(divider.main)&quot;</code> follows the palette and dark mode; <code>&quot;xs(space(2)) md(space(3))&quot;</code> follows the spacing scale. A border radius does not clip children; add <code>overflow</code> when it must.</li>
      </ul>
      <pre><code className="language-css">{`.card--selected {
  border: border(1);
  border-style: dashed;
  border-color: palette(primary.main);
}
.tag { border-radius: radius(full); }  /* UXD_SYNTAX_REMOVED: write radius(pill) */`}</code></pre>
      <p>The guides for coding agents are on <Link href="/docs/for-ai-agents#ai-borders-guide">For AI agents</Link>.</p>
    </section>
  )
}
