import { DEFAULT_BREAKPOINTS } from 'uxdsl/theme'
import AgentGuidance from '../AgentGuidance'

const theme = JSON.stringify({ breakpoints: DEFAULT_BREAKPOINTS }, null, 2)
const usage = `.layout {
  display: flex;
  flex-direction: xs(column) md(row);
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
