import Link from 'next/link'
import { DEFAULT_BREAKPOINTS } from 'uxdsl/theme'
import WriteGet from './WriteGet'

// The breakpoints a block can name: every one with a query, so the base (0px) is left out.
const blockBreakpoints = Object.entries(DEFAULT_BREAKPOINTS).filter(([, width]) => width > 0)

// The block form on /docs/breakpoints. The chips are styled by breakpoints.uxdsl, one
// @media (--name) block each; resize the window and each takes the contained role from its
// own breakpoint up.
export function BreakpointBlocks() {
  return (
    <section className="doc-section" aria-labelledby="breakpoint-blocks">
      <h2 id="breakpoint-blocks">Blocks from a breakpoint up</h2>
      <p>
        When a whole block applies from a breakpoint up — several declarations, nested rules or a directive — write{' '}
        <code>@media (--md) {'{'} … {'}'}</code>. UXDSL replaces <code>(--md)</code> with the theme’s query for{' '}
        <code>md</code>, the one <code>md()</code> produces, so the block moves when the theme’s threshold moves. Each chip
        below is outlined, and takes the contained role from its own breakpoint up:
      </p>
      <ul className="bp-blocks" aria-label="Breakpoint blocks">
        {blockBreakpoints.map(([name, width]) => (
          <li key={name} className={`bp-chip bp-chip--${name}`}>(--{name}) from {width}px</li>
        ))}
      </ul>
      <WriteGet id="breakpoint-blocks" />
    </section>
  )
}

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
        <li>A block from a breakpoint up is <code>@media (--md) {'{'} … {'}'}</code>: <code>(--md)</code> compiles to the query <code>md()</code> produces, and combines with other conditions (<code>print and (--md)</code>). The base has no query, so <code>(--xs)</code> is <code>UXD_BREAKPOINT_CONTEXT</code>; a name that is not a breakpoint is <code>UXD_BREAKPOINT_UNKNOWN</code>. A literal query, <code>@media (min-width: 600px)</code>, is compiled as written.</li>
        <li>A directive from a breakpoint up: in a <code>.uxdsl</code> file the block may sit inside the rule, and Dart Sass moves it out around the rule; with <code>uxdsl/postcss</code> alone, put the rule inside the block. A project’s own <code>@custom-media --md …</code> replaces the theme’s <code>md</code> in that stylesheet, with the warning <code>UXD_BREAKPOINT_SHADOWED</code>.</li>
        <li>Moving a threshold moves every rule compiled with it, so it is a theme edit and a rebuild: <code>applyTheme</code> refuses it with <code>UXD_THEME_STRUCTURE</code>. <code>inspectResponsiveValue</code> (<code>uxdsl/language</code>) tells an editor what a value resolves to at a width, without a document — that is what the demo above does.</li>
      </ul>
      <pre><code className="language-css">{`.layout { display: flex; flex-direction: xs(column) md(row); gap: density(3); }
.sidebar { display: xs(none) lg(block); }
@media (--md) { .layout { gap: density(4); } }
@media print and (--lg) { .sidebar { display: none; } }
@media (--lgg) { .sidebar { display: block; } }  /* UXD_BREAKPOINT_UNKNOWN: did you mean (--lg)? */`}</code></pre>
      <p>The guide for coding agents is on <Link href="/docs/for-ai-agents#ai-breakpoints-guide">For AI agents</Link>.</p>
    </section>
  )
}
