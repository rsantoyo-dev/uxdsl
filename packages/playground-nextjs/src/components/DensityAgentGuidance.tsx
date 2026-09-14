import AgentGuidance from './AgentGuidance'
import SpacingPrinciple from './SpacingPrinciple'

const exampleTheme = `{
  "breakpoints": {
    "xs": 0,
    "md": 768,
    "xl": 1280
  },
  "spacing": {
    "4": "0.75rem",
    "5": "1rem",
    "6": "1.5rem"
  },
  "densities": {
    "4": "xs(space(4)) md(space(5)) xl(space(6))"
  }
}`

export default function DensityAgentGuidance() {
  return (
    <AgentGuidance id="ai-density-guide" title="How an AI agent should use Density">
      <SpacingPrinciple />
      <p>When generating or modifying UI with UXDSL:</p>
      <ul>
        <li>Read the theme&apos;s <code>spacing</code>, <code>densities</code>, and <code>breakpoints</code> definitions before selecting spacing tokens.</li>
        <li>Prefer existing design-system tokens over introducing new values, tokens, or responsive rules.</li>
        <li>Prefer an appropriate <code>density(n)</code> token by default for component spacing.</li>
        <li>Use <code>space(n)</code> directly when a stable value across breakpoints is intentional. Use CSS directly when finer control outside the configured Density behavior is required.</li>
        <li>Do not replace Density with Spacing merely because their values match at one breakpoint. That would discard the intended responsive progression.</li>
        <li>If no Density token fits, inspect the theme and requested scope before creating a system-level token or choosing a deliberate local exception. Never reference an undefined token.</li>
        <li>Treat <code>density(n)</code> as a reference to a configured responsive spacing token. Never assume <code>density(4)</code> equals <code>space(4)</code> at every breakpoint.</li>
        <li>Reuse existing Density tokens when their configured progression matches the intended behavior.</li>
        <li>Do not reference undefined Density or Spacing tokens. When a new token is needed, define it in the theme before using it.</li>
        <li>Do not reproduce a Density mapping locally with explicit breakpoint rules when an existing Density token already represents the intended behavior.</li>
        <li>Change a Density mapping in the theme when the intended change should affect all consumers of that token.</li>
        <li>Use a local component rule when the behavior is an intentional exception that should not affect the Density token or its other consumers.</li>
        <li>Before creating a new Density token, check whether an existing token already provides the required responsive progression.</li>
        <li>Verify the result just below, at, and just above each configured breakpoint where those widths are valid, and check other components consuming the same Density token.</li>
      </ul>
      <p><strong>Decision rule:</strong> Prefer Density for component spacing. Use Spacing for intentional stable values and CSS for finer control. Change shared Spacing or Density definitions only for intentional system-level changes.</p>
      <p><em>Choose the token in the component. Define its responsive behavior in the theme.</em></p>

      <h3>Example</h3>
      <p>Given this example theme excerpt:</p>
      <pre><code className="language-json">{exampleTheme}</code></pre>
      <p>When a component should follow that configured responsive progression, prefer:</p>
      <pre><code className="language-css">{`.card {
  padding: density(4);
}`}</code></pre>
      <p>This resolves according to the theme:</p>
      <ul>
        <li>Below <code>768px</code> → <code>space(4)</code> → <code>0.75rem</code>.</li>
        <li>From <code>768px</code> up to, but not including, <code>1280px</code> → <code>space(5)</code> → <code>1rem</code>.</li>
        <li><code>1280px</code> and above → <code>space(6)</code> → <code>1.5rem</code>.</li>
      </ul>
      <p>Avoid recreating the same system behavior locally:</p>
      <pre><code className="language-css">{`.card {
  padding: xs(space(4)) md(space(5)) xl(space(6));
}`}</code></pre>
      <p>The local form duplicates behavior already represented by <code>density(4)</code> and disconnects the component from future changes to that Density mapping. It still references the spacing scale.</p>
      <p>Explicit local responsive spacing is valid when the component intentionally requires behavior that should remain independent from the configured Density mapping.</p>

      <h3>Agent reasoning example</h3>
      <p>If asked:</p>
      <blockquote>Make this card&apos;s padding follow the application&apos;s responsive spacing.</blockquote>
      <p>The agent should:</p>
      <ol>
        <li>Inspect the theme&apos;s available Density tokens.</li>
        <li>Find an existing Density progression that matches the requested behavior.</li>
        <li>Use that token in the component, for example <code>padding: density(4)</code>.</li>
        <li>Avoid generating local breakpoint rules that duplicate the token&apos;s progression.</li>
        <li>Only create or modify a Density token when the requested behavior belongs at the design-system level.</li>
        <li>Verify the resulting behavior around every configured breakpoint and check affected consumers when the Density mapping changes.</li>
      </ol>
      <p>The component declares <strong>which responsive spacing token it uses</strong>.</p>
      <p>The theme defines <strong>how that token behaves across breakpoints</strong>.</p>
    </AgentGuidance>
  )
}
