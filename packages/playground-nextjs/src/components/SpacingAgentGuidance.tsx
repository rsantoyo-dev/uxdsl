import AgentGuidance from './AgentGuidance'

export default function SpacingAgentGuidance() {
  return (
    <AgentGuidance id="ai-spacing-guide" title="How an AI agent should use Spacing">
      <p>When generating or modifying UI with UXDSL:</p>
      <ul>
        <li>Inspect the active theme’s <code>spacing</code> definitions and existing component conventions before selecting tokens. Read <code>densities</code> and <code>breakpoints</code> when responsive behavior is required.</li>
        <li>Treat <code>space(n)</code> as a configured token reference, not a pixel count or arithmetic multiplier. Do not infer values from another framework’s scale.</li>
        <li>Prefer an existing token that matches the intended spacing. Do not reference undefined tokens; define a new token in the theme before using it when a system-level addition is needed.</li>
        <li>Use <code>space(n)</code> for a direct spacing value and <code>density(n)</code> for a responsive progression defined by the theme. Do not duplicate an existing Density progression locally.</li>
        <li>Choose padding for internal space, margin for external separation, and gap for spacing between items in a compatible layout.</li>
        <li>Change a shared spacing value only when the intended change should affect all its consumers. Inspect direct references and Density mappings that depend on it.</li>
        <li>For a local adjustment, select another appropriate token in the component. Use a deliberate local exception when the design requires behavior independent of shared tokens.</li>
        <li>Edit source theme definitions or use the supported runtime API. Do not hand-edit generated CSS as the source of truth.</li>
        <li>Account for the configured units. A stable <code>rem</code> value can have a different pixel size when the root font size changes; <code>space()</code> itself does not create breakpoint rules.</li>
        <li>Verify affected padding, margins and gaps, check shared consumers for overflow or wrapping, and test relevant themes. If Density references the edited token, also check its breakpoint boundaries.</li>
      </ul>
      <p><strong>Decision rule:</strong> Choose an existing token for a component change. Change the shared token value for an intentional system-wide change.</p>
      <h3>Example</h3>
      <p>Given this theme excerpt:</p>
      <pre><code className="language-json">{`{
  "spacing": {
    "2": "0.25rem",
    "4": "0.75rem",
    "6": "1.5rem"
  }
}`}</code></pre>
      <p>Reuse the configured value:</p>
      <pre><code className="language-css">{`.card {
  padding: space(4);
}
.actions {
  display: flex;
  gap: space(4);
}`}</code></pre>
      <p>Both references resolve to <code>0.75rem</code>. Avoid replacing them with a hardcoded <code>0.75rem</code> when they should remain connected to the theme.</p>
      <h3>Agent reasoning example</h3>
      <blockquote>Make only this card’s padding smaller using the application’s spacing scale.</blockquote>
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
