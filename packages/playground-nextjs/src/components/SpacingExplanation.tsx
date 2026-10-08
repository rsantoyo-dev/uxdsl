import Link from 'next/link'
import SpacingPrinciple from './SpacingPrinciple'

// The rules section of /docs/spacing.
export default function SpacingRules() {
  return (
    <section className="doc-section" aria-labelledby="spacing-rules">
      <h2 id="spacing-rules">Rules</h2>
      <SpacingPrinciple />
      <ul>
        <li><code>space(k)</code> is one step of the scale, the same at every width. <code>density(k)</code> is a step the theme moves at breakpoints — the base theme’s <code>density(4)</code> is <code>space(4)</code>, then <code>space(5)</code> from <code>md</code>, then <code>space(6)</code> from <code>xl</code>.</li>
        <li>A key is a name, not a number of pixels or a multiplier: <code>density(2.5)</code> is <code>UXD_TOKEN_KEY</code>, an undefined key is <code>UXD_DENSITY_REFERENCE</code> / <code>UXD_SPACE_REFERENCE</code> with the keys that exist.</li>
        <li>Do not copy a density’s ladder into a component (<code>padding: xs(space(4)) md(space(5))</code>): the component stops following the theme. Change the density in the theme and every consumer follows.</li>
        <li><code>space(0)</code> and <code>density(0)</code> are an explicit zero. Spacing values are <code>rem</code> by default, so they still follow the root font size.</li>
        <li>Changing <code>spacing[&quot;4&quot;]</code> changes direct <code>space(4)</code> uses and every density, radius or typography value that references it; changing <code>densities[&quot;4&quot;]</code> changes only <code>density(4)</code> uses.</li>
      </ul>
      <pre><code className="language-css">{`.card { padding: density(4); }
.toolbar { gap: space(2); }
.card { padding: density(2.5); }  /* UXD_TOKEN_KEY: a key is a name, not a number to scale */`}</code></pre>
      <p>The guides for coding agents are on <Link href="/docs/for-ai-agents#ai-spacing-guide">For AI agents</Link>.</p>
    </section>
  )
}
