import { DEFAULT_BREAKPOINTS } from 'uxdsl/theme'
import DemoBreakpointsCards from './DemoBreakpointsCards'

const theme = JSON.stringify({ breakpoints: DEFAULT_BREAKPOINTS }, null, 2)
const usage = `.layout {
  display: flex;
  flex-direction: xs(column) md(row);
}`
const css = `.layout {
  display: flex;
  flex-direction: column;
}
@media (min-width: ${DEFAULT_BREAKPOINTS.md}px) {
  .layout { flex-direction: row; }
}`

function Principle() {
  return <p>Breakpoints name the viewport widths where responsive rules begin to apply. The theme JSON defines the thresholds, components use those names for layout changes, and Density uses them to make Spacing responsive. <strong>Prefer Density for component spacing</strong>; use explicit breakpoint values for layout behavior and deliberate local exceptions.</p>
}

function RulePersistence() {
  return (
    <div className="doc-section__table-wrap">
      <table>
        <caption>How this example keeps its most recent applicable value</caption>
        <thead><tr><th>Viewport width</th><th>flex-direction</th><th>Supplying rule</th></tr></thead>
        <tbody>
          <tr><td>Below {DEFAULT_BREAKPOINTS.md}px</td><td><code>column</code></td><td><code>xs(column)</code></td></tr>
          <tr><td>From {DEFAULT_BREAKPOINTS.md}px up to, but not including, {DEFAULT_BREAKPOINTS.xl}px</td><td><code>row</code></td><td><code>md(row)</code> remains active through lg</td></tr>
          <tr><td>{DEFAULT_BREAKPOINTS.xl}px and above</td><td><code>row</code></td><td><code>md(row)</code> remains active unless a later rule overrides it</td></tr>
        </tbody>
      </table>
    </div>
  )
}

export function BreakpointExplanation() {
  return (
    <section className="doc-section" aria-labelledby="breakpoints-explained">
      <h2 id="breakpoints-explained">One set of thresholds for responsive decisions.</h2>
      <Principle />
      <p>A name such as <code>md</code> identifies a configured threshold. It does not detect a tablet, orientation or input device. These examples use viewport width, not container width.</p>
      <h3>1. Define breakpoints in your theme JSON</h3>
      <p>This excerpt uses the shared engine defaults. Your theme can configure different values:</p>
      <pre><code className="language-json">{theme}</code></pre>
      <div className="doc-section__table-wrap"><table>
        <caption>Default minimum viewport widths</caption>
        <thead><tr><th>Name</th><th>Minimum width</th></tr></thead>
        <tbody>{Object.entries(DEFAULT_BREAKPOINTS).map(([name, width]) => <tr key={name}><td><code>{name}</code></td><td>{width}px</td></tr>)}</tbody>
      </table></div>
      <p>Keep <code>xs</code> at zero for these examples and use ordered, distinct thresholds. Feed the configured map into your build/runtime integration so the generated CSS and active theme use the same definitions.</p>
      <h3>2. Declare what changes at a threshold</h3>
      <div className="doc-section__comparison">
        <div><h4>UXDSL you write</h4><pre><code className="language-css">{usage}</code></pre></div>
        <div><h4>Equivalent plain CSS</h4><pre><code className="language-css">{css}</code></pre></div>
      </div>
      <p>With these defaults, the layout is a column below <code>{DEFAULT_BREAKPOINTS.md}px</code> and a row at that width and above. The threshold is inclusive. This is a discrete change, not a fluid interpolation.</p>
      <p>A declared value continues to apply until a later applicable rule overrides it. At <code>lg</code>, this example still uses <code>md(row)</code> because no <code>lg()</code> override was declared. The active viewport breakpoint and the rule supplying a property’s value are not necessarily the same.</p>
      <RulePersistence />
      <h3>3. Let Density manage shared responsive spacing</h3>
      <pre><code className="language-json">{`{
  "densities": {
    "4": "xs(space(4)) md(space(5)) xl(space(6))"
  }
}`}</code></pre>
      <p>This additional theme excerpt assumes spacing entries <code>4</code>, <code>5</code> and <code>6</code> exist.</p>
      <pre><code className="language-css">{`.layout {
  display: flex;
  flex-direction: xs(column) md(row);
  padding: density(4);
}`}</code></pre>
      <p>The component defines its layout transition; Density defines its spacing progression. Changing <code>md</code> changes when both rules apply after the configuration is compiled or applied. Changing only a Density mapping changes spacing without moving the layout threshold.</p>
      <p>Do not repeat a Density progression locally merely because it produces the same result today. Use <code>space()</code> for intentional stable spacing, explicit responsive values for deliberate local exceptions, and standard CSS when finer control is needed.</p>
      <h3>Explore the current viewport</h3>
      <p>The playground below reports the actual browser viewport and the active theme&apos;s thresholds, and simulates any width: it shows which breakpoint is active there and what a few responsive declarations resolve to, using the same <code>inspectResponsiveValue</code> an editor would. Simulating a width does not resize the browser, and nothing here edits the theme: thresholds are compiled into the components, so moving one is a change to the theme JSON and a rebuild.</p>
    </section>
  )
}

export function BreakpointLiveExample() {
  return (
    <section className="doc-section" aria-labelledby="breakpoint-live-layout">
      <h2 id="breakpoint-live-layout">Live layout example</h2>
      <p>The cards below switch from column to row at <code>md</code>. This excerpt matches their responsive declarations. Their spacing is a deliberate local progression for this demonstration; prefer Density for shared component spacing.</p>
      <pre><code className="language-css">{`#DemoBreakpointsCards {
  display: flex;
  flex-direction: xs(column) md(row);
  gap: xs(space(2)) md(space(4));
  padding: xs(space(3)) md(space(6));
}`}</code></pre>
      <DemoBreakpointsCards />
      <h3>Thresholds are compiled, not applied at run time</h3>
      <p>A threshold is baked into every component&apos;s <code>@media</code> rule at build time, so the runtime cannot move one: <code>applyTheme</code> refuses the patch and names the reason.</p>
      <pre><code className="language-typescript">{`import { applyTheme } from 'uxdsl/runtime'
import { inspectResponsiveValue } from 'uxdsl/language'

const result = applyTheme({ breakpoints: { md: 800 } })
result.ok // false — result.error.code === 'UXD_THEME_STRUCTURE': edit the theme file and rebuild

// Inspection at a width needs no document and changes nothing:
inspectResponsiveValue('xs(column) md(row)', 820, { xs: 0, md: 768 })
// { active: 'md', applied: 'md', value: 'row' }`}</code></pre>
      <p>The playground above simulates widths this way. Changing <code>breakpoints</code> in the theme JSON and rebuilding is the one supported way to move a threshold; verify the resulting media rules in your integration.</p>
    </section>
  )
}

