import Link from 'next/link'

// The rules section of /docs/colors.
export function ColorRules() {
  return (
    <section className="doc-section" aria-labelledby="color-rules">
      <h2 id="color-rules">Rules</h2>
      <ul>
        <li><strong>Colors are values; the palette gives them roles.</strong> <code>colors</code> holds families of shades (<code>gray.50</code> … <code>gray.950</code>) and single names; <code>palette</code> holds roles (<code>primary</code>, <code>surface</code>, <code>text</code>, …), each with variants (<code>main</code>, <code>light</code>, <code>dark</code>, <code>contrast</code>, …).</li>
        <li>In a component, name a role: <code>palette(primary.main)</code>. Name a color only for a color identity — a swatch, a brand mark. <code>palette(primary)</code> means <code>palette(primary.main)</code>.</li>
        <li>A palette value references a color (<code>&quot;main&quot;: &quot;color(blue.700)&quot;</code>) and follows it; a copied hex does not. A shade number is a key, not a lightness; <code>contrast</code> is the foreground the theme assigns, not a guarantee — the <Link href="/docs/accessibility">contrast gate</Link> checks it.</li>
        <li>Dark mode is <code>modes.dark.palette</code>: only the keys that change. The compiled CSS applies them under <code>prefers-color-scheme: dark</code> and under <code>data-theme=&quot;dark&quot;</code>; components never know which mode is active.</li>
        <li>An alpha is the second argument, 0 to 1: <code>palette(primary.main, 0.1)</code> compiles to <code>color-mix(… transparent)</code>. The dashed spelling (<code>palette(primary-main)</code>) is <code>UXD_PALETTE_SYNTAX</code>; an unknown variant is <code>UXD_PALETTE_REFERENCE</code> with the variants that exist.</li>
        <li>A family is a tone for <code>@ds-surface</code>, <code>@ds-button</code> and <code>@ds-input</code> when it has <code>main</code>, <code>dark</code> and <code>contrast</code>.</li>
      </ul>
      <pre><code className="language-css">{`.cta { background: palette(primary.main); color: palette(primary.contrast); }
.overlay { background: color(black, 0.5); }
.badge { color: palette(primary.mian); }  /* UXD_PALETTE_REFERENCE: primary has main, light, dark, contrast */`}</code></pre>
      <p>The guides for coding agents are on <Link href="/docs/for-ai-agents#ai-colors-guide">For AI agents</Link>.</p>
    </section>
  )
}
