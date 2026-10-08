import Link from 'next/link'
import { DEFAULT_BREAKPOINTS } from 'uxdsl/theme'

// The rules section of /docs/breakpoints. The thresholds in the table come from the engine's
// own DEFAULT_BREAKPOINTS, not from this file.
export function BreakpointRules() {
  return (
    <section className="doc-section" aria-labelledby="breakpoint-rules">
      <h2 id="breakpoint-rules">Rules</h2>
      <div className="doc-section__table-wrap">
        <table>
          <caption>The base theme’s breakpoints (minimum viewport widths)</caption>
          <thead><tr><th>Name</th><th>From</th></tr></thead>
          <tbody>{Object.entries(DEFAULT_BREAKPOINTS).map(([name, width]) => <tr key={name}><td><code>{name}()</code></td><td>{width}px</td></tr>)}</tbody>
        </table>
      </div>
      <ul>
        <li><strong>The theme is the only place a threshold is set</strong>: <code>breakpoints</code> in the theme file. The base (<code>xs</code>) is 0; widths are distinct, non-negative numbers (<code>UXD_BP_INVALID</code>). A new name adds its function.</li>
        <li>A name is a width, not a device. Breakpoints are viewport <code>min-width</code> media queries; for a component that responds to its container, write native <code>@container</code> next to UXDSL.</li>
        <li>A value applies from its breakpoint up, until a later one overrides it: in <code>xs(column) md(row)</code>, <code>lg</code> and <code>xl</code> are still <code>row</code>. It steps; it does not interpolate.</li>
        <li>For spacing, prefer a density over a breakpoint in the component: the progression then lives in the theme, shared. Use breakpoint functions for layout changes that belong to the component.</li>
        <li>Moving a threshold moves every rule compiled with it, so it is a theme edit and a rebuild: <code>applyTheme</code> refuses it with <code>UXD_THEME_STRUCTURE</code>. <code>inspectResponsiveValue</code> (<code>uxdsl/language</code>) tells an editor what a value resolves to at a width, without a document — that is what the demo above does.</li>
      </ul>
      <pre><code className="language-css">{`.layout { display: flex; flex-direction: xs(column) md(row); gap: density(3); }
.sidebar { display: xs(none) lg(block); }`}</code></pre>
      <p>The guide for coding agents is on <Link href="/docs/for-ai-agents#ai-breakpoints-guide">For AI agents</Link>.</p>
    </section>
  )
}
