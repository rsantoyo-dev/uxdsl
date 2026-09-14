import { DEFAULT_BREAKPOINTS } from 'postcss-uxdsl/language'
import AgentGuidance from './AgentGuidance'
import DemoBreakpointsCards from './DemoBreakpointsCards'
import styles from './BreakpointDocumentation.module.css'

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
    <div className={styles.tableWrap}>
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
    <section className={styles.content} aria-labelledby="breakpoints-explained">
      <h2 id="breakpoints-explained">One set of thresholds for responsive decisions.</h2>
      <Principle />
      <p>A name such as <code>md</code> identifies a configured threshold. It does not detect a tablet, orientation or input device. These examples use viewport width, not container width.</p>
      <h3>1. Define breakpoints in your theme JSON</h3>
      <p>This excerpt uses the shared engine defaults. Your theme can configure different values:</p>
      <pre><code className="language-json">{theme}</code></pre>
      <div className={styles.tableWrap}><table>
        <caption>Default minimum viewport widths</caption>
        <thead><tr><th>Name</th><th>Minimum width</th></tr></thead>
        <tbody>{Object.entries(DEFAULT_BREAKPOINTS).map(([name, width]) => <tr key={name}><td><code>{name}</code></td><td>{width}px</td></tr>)}</tbody>
      </table></div>
      <p>Keep <code>xs</code> at zero for these examples and use ordered, distinct thresholds. Feed the configured map into your build/runtime integration so the generated CSS and active theme use the same definitions.</p>
      <h3>2. Declare what changes at a threshold</h3>
      <div className={styles.comparison}>
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
      <p>The playground below reports the actual browser viewport and edits its breakpoint configuration. Moving a threshold does not resize the browser. Move <code>md</code> across the current viewport width to inspect the transition. Editor constraints keep thresholds ordered; browser overrides may persist. These edits do not write your source JSON file.</p>
    </section>
  )
}

export function BreakpointLiveExample() {
  return (
    <section className={styles.content} aria-labelledby="breakpoint-live-layout">
      <h2 id="breakpoint-live-layout">Live layout example</h2>
      <p>The cards below switch from column to row at <code>md</code>. This excerpt matches their responsive declarations. Their spacing is a deliberate local progression for this demonstration; prefer Density for shared component spacing.</p>
      <pre><code className="language-css">{`#DemoBreakpointsCards {
  display: flex;
  flex-direction: xs(column) md(row);
  gap: xs(space(2)) md(space(4));
  padding: xs(space(3)) md(space(6));
}`}</code></pre>
      <DemoBreakpointsCards />
      <h3>Runtime configuration</h3>
      <p>In a browser integration with UXDSL-generated styles loaded, the runtime exposes breakpoint updates:</p>
      <pre><code className="language-typescript">{`import { breakpoints } from 'postcss-uxdsl/ds-runtime'

const current = breakpoints.get()
breakpoints.update('md', 800)

const unsubscribe = breakpoints.subscribe((event) => {
  if (event.type === 'breakpoint') {
    console.log(breakpoints.get())
  }
})

// Call during cleanup when the subscriber is no longer needed.
unsubscribe()`}</code></pre>
      <p>The subscription reports configuration updates; it is not a viewport-resize subscription. A runtime change does not edit the JSON file. Verify the resulting media rules in your integration, especially when stylesheets or overrides are loaded separately.</p>
    </section>
  )
}

export function BreakpointAgentGuidance() {
  return (
    <AgentGuidance id="ai-breakpoints-guide" title="How an AI agent should use Breakpoints">
      <Principle />
      <p><strong>Responsibility: preserve the shared responsive thresholds.</strong> Decide whether the request changes a component’s behavior, a Density mapping, or a system-wide threshold before editing configuration.</p>
      <ul>
        <li>Read the actual theme’s <code>breakpoints</code>. Do not import values from another framework or infer device types from breakpoint names.</li>
        <li>Use configured breakpoint names for explicit responsive layout changes. Define a base value when needed, and remember that the most recent applicable rule remains active until a rule at another configured breakpoint overrides it.</li>
        <li>Prefer existing Density tokens for component spacing. Read their mappings before changing a breakpoint they depend on.</li>
        <li>Change a shared threshold only when all affected responsive rules should move. For a local change, adjust the component’s responsive declarations using existing breakpoint names, or choose a deliberate local exception.</li>
        <li>Do not replace Density with local breakpoint values just because their current computed values match. Preserve the intended system dependency.</li>
        <li>Define required new thresholds through supported configuration before using them, and check support in the runtime and editor integrations. Do not assume all tools accept arbitrary names.</li>
        <li>Keep source configuration aligned with compiler/runtime inputs. A browser-only override or manually edited generated CSS is not an update to the theme JSON.</li>
        <li>Verify just below, at and just above affected thresholds, using valid nonnegative widths. Check intermediate inheritance, layout overflow, dependent Density rules and other shared consumers.</li>
      </ul>
      <p><strong>Decision rule:</strong> Change the component to change local behavior. Change a breakpoint to intentionally move a shared threshold. Change Density to adjust shared responsive spacing.</p>
      <h3>Configuration and usage example</h3>
      <pre><code className="language-json">{theme}</code></pre>
      <pre><code className="language-css">{usage}</code></pre>
      <RulePersistence />
      <h3>Agent reasoning example</h3>
      <blockquote>Move the shared md transition to 800px across the application.</blockquote>
      <ol>
        <li>Inspect the active configuration and confirm 800px fits between the intended neighboring thresholds.</li>
        <li>Find component rules and Density mappings referencing <code>md</code>. Confirm the request includes these consumers.</li>
        <li>Update <code>breakpoints.md</code> in the source JSON and apply it through the project’s build or runtime integration.</li>
        <li>Verify the column layout at 799px and row layout at 800px and 801px. Check Density transitions and consumers without an explicit <code>md()</code> rule.</li>
        <li>Check a later breakpoint to confirm the row value persists unless another declaration overrides it.</li>
      </ol>
      <p><em>Breakpoints define when. Components and Density define what changes.</em></p>
    </AgentGuidance>
  )
}
