import AgentGuidance from '../AgentGuidance'

export function ButtonAgentGuidance() {
  return <AgentGuidance id="ai-buttons-guide" title="How an AI agent should use Buttons">
    <p><strong>Responsibility: preserve shared action roles and their visual states.</strong> Preserve intent, not just the current computed value.</p>
    <ul>
      <li>Inspect buttons, surfaces, Palette, Density, Radii, Borders, Shadows and breakpoints before choosing a role.</li>
      <li>Reuse a configured Button role. Do not replace its directive with currently resolved colors, padding or state styles.</li>
      <li>Choose semantic HTML and implement activation, disabled and toggle behavior independently of styling.</li>
      <li>Inspect inherited base and state fields. Define a custom role in JSON before referencing it. Explicit base fields override the selected Surface composition.</li>
      <li>Use a tone or numeric size only for intentional overrides. Check Palette variants and both Density and Radius keys. Never infer pixels from a token number.</li>
      <li>Change shared definitions only when their consumers should change. Select another role or use subsequent CSS for an isolated exception.</li>
      <li>Keep responsive progressions in the theme and preserve their token dependencies. Include a base value and verify persistence between thresholds.</li>
      <li>Update existing values through managed theme CSS; regenerate component CSS for structural changes to roles or state fields.</li>
      <li>Verify hover, active, selected, disabled, keyboard focus, contrast, wrapping and breakpoint boundaries. Check other consumers of shared dependencies.</li>
    </ul>
    <p><strong>Decision rule:</strong> Choose the configured action role in the component. Maintain shared visual behavior in the theme; keep interaction semantics in HTML and application logic.</p>
    <h3>Agent reasoning example</h3>
    <p>For “increase the selected checkout action depth on desktop,” inspect the checkout role, change its selected shadow progression and verify all checkout consumers around each threshold. Keep their Button references. For one exceptional action, use a suitable existing role or intentional local CSS.</p>
  </AgentGuidance>
}
