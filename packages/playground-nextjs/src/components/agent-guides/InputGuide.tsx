import AgentGuidance from '../AgentGuidance'

export function InputAgentGuidance() {
  return <AgentGuidance id="ai-inputs-guide" title="How an AI agent should use Inputs">
    <p><strong>Responsibility: preserve shared field roles and visual states while keeping form semantics in HTML and application logic.</strong> Preserve intent, not just the current computed value.</p>
    <ul>
      <li>Inspect inputs, surfaces, referenced Density, Radius, Palette, Borders, Shadows and breakpoints before choosing or modifying a role.</li>
      <li>Reuse a suitable configured role with @ds-input(role). Do not copy its current resolved colors, padding or focus treatment into local CSS.</li>
      <li>Inspect inherited fields. Custom roles inherit contained defaults; explicit base fields override the selected Surface composition. Define a role and its dependencies before using it.</li>
      <li>Use optional tones and sizes deliberately. Check the Palette family and both Density and Radius keys. Keep error styling connected to its error meaning.</li>
      <li>Use labels, appropriate input types, native disabled/readOnly behavior and associated error messages. aria-invalid communicates an error; it does not validate the value.</li>
      <li>Keep placeholder styling separate from labels. Preserve visible keyboard focus and check actual contrast and native interaction.</li>
      <li>Modify shared role definitions only when all consumers should follow. Select another role or use subsequent local CSS for an isolated exception.</li>
      <li>Generate successfully before replacing managed theme CSS. Regenerate component CSS when adding/removing fields or changing Surface selection. Preview edits do not save JSON.</li>
      <li>Verify below, at and above configured breakpoints, intermediate persistence, focus, hover, invalid, disabled, readonly, placeholder states and every affected consumer.</li>
    </ul>
    <p><strong>Decision rule:</strong> Choose the configured field role in the component. Maintain shared visual behavior in the theme; implement validation and interaction semantics separately.</p>
    <h3>Agent reasoning example</h3>
    <p>For “make all search fields use a stronger error border,” inspect the search role and its consumers, change its invalid border in the theme, regenerate the needed CSS and verify native and aria-invalid states. Keep components using @ds-input(search). For one exceptional field, choose another role or deliberate local CSS.</p>
  </AgentGuidance>
}
