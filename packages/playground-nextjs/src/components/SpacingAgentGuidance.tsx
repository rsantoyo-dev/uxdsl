import AgentGuidance from './AgentGuidance'
import SpacingPrinciple from './SpacingPrinciple'

export default function SpacingAgentGuidance() {
  return (
    <AgentGuidance id="ai-spacing-guide" title="How an AI agent should use Spacing">
      <SpacingPrinciple />
      <p>When generating or modifying UI with UXDSL:</p>
      <ul>
        <li>Inspect the active theme’s <code>spacing</code> definitions and existing component conventions before selecting tokens. Read <code>densities</code> and <code>breakpoints</code> when responsive behavior is required.</li>
        <li>Treat <code>space(n)</code> as a configured token reference, not a pixel count or arithmetic multiplier. Do not infer values from another framework’s scale.</li>
        <li>Prefer an existing token that matches the intended spacing. Do not reference undefined tokens; define a new token in the theme before using it when a system-level addition is needed.</li>
        <li>Prefer an appropriate <code>density(n)</code> token for component spacing. Use <code>space(n)</code> directly when a stable value is intentional, and use CSS directly when finer control is required. Do not duplicate an existing Density progression locally.</li>
        <li>Do not choose <code>space(n)</code> merely because it matches a Density token at the current breakpoint. Preserve the component’s intended responsive behavior.</li>
        <li>If no Density token fits, inspect the theme and the requested scope before defining a system-level token or using a deliberate local exception. Never invent an undefined reference.</li>
        <li>Choose padding for internal space, margin for external separation, and gap for spacing between items in a compatible layout.</li>
        <li>Change a shared spacing value only when the intended change should affect all its consumers. Inspect direct references and Density mappings that depend on it.</li>
        <li>For a local adjustment, select another appropriate token in the component. Use a deliberate local exception when the design requires behavior independent of shared tokens.</li>
        <li>Edit source theme definitions or use the supported runtime API. Do not hand-edit generated CSS as the source of truth.</li>
        <li>Account for the configured units. A stable <code>rem</code> value can have a different pixel size when the root font size changes; <code>space()</code> itself does not create breakpoint rules.</li>
        <li>Verify affected padding, margins and gaps, check shared consumers for overflow or wrapping, and test relevant themes. If Density references the edited token, also check its breakpoint boundaries.</li>
      </ul>
      <p><strong>Decision rule:</strong> Prefer Density for component spacing. Use Spacing for intentional stable values and CSS for finer control. Change shared Spacing or Density definitions only for intentional system-level changes.</p>
      <h3>Example</h3>
      <p>Given this theme excerpt:</p>
      <pre><code className="language-json">{`{
  "spacing": {
    "2": "0.25rem",
    "4": "0.75rem",
    "6": "1.5rem"
  }
}`}</code></pre>
      <p>For this deliberate exception, the card padding and actions gap must remain stable across breakpoints. Reuse the configured Spacing value:</p>
      <pre><code className="language-css">{`.card {
  padding: space(4);
}
.actions {
  display: flex;
  gap: space(4);
}`}</code></pre>
      <p>Both references resolve to <code>0.75rem</code>. Avoid replacing them with a hardcoded <code>0.75rem</code> when they should remain connected to the theme.</p>
      <h3>Agent reasoning example</h3>
      <blockquote>Make only this card’s padding smaller, and intentionally keep it stable across breakpoints using the application’s spacing scale.</blockquote>
      <ol>
        <li>Inspect the card’s current token and the actual spacing values in the theme.</li>
        <li>Choose an appropriate smaller existing value; in this example, <code>space(2)</code> is smaller than <code>space(4)</code>.</li>
        <li>Change the card to <code>padding: space(2)</code>. Keep the shared value of spacing entry <code>4</code> intact because the request applies only to the card.</li>
        <li>Check the card’s content, wrapping and overflow, and confirm that the actions gap remains unchanged.</li>
      </ol>
      <p>If the request instead changes spacing entry <code>4</code> across the system, update its theme value, apply or compile the theme, and verify both direct consumers and dependent Density mappings.</p>
      <p><em>Choose the token in the component. Define its value in the theme.</em></p>
    </AgentGuidance>
  )
}
