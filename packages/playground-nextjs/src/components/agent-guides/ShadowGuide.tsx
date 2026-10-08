import AgentGuidance from '../AgentGuidance'


export function ShadowAgentGuidance() {
  return <>
    <AgentGuidance id="ai-shadows-guide" title="How an AI agent should use Shadows">
      <p><strong>Responsibility: maintain shared depth treatments and their responsive behavior.</strong> Preserve intent, not just the current computed value.</p>
      <ul>
        <li>Inspect the effective <code>shadows</code> configuration, breakpoints and referenced color or spacing tokens before selecting a preset.</li>
        <li>Reuse an appropriate configured <code>shadow(key)</code> for box shadows (the former <code>elevation()</code> alias fails as <code>UXD_SYNTAX_REMOVED</code>). Do not infer visual strength from a numeric key or confuse depth with z-index.</li>
        <li>Preserve layers, nested color functions, inset flags, units and token references. Do not split shadow expressions with a simple comma-based parser.</li>
        <li>Do not copy resolved shadow values into a component that should remain connected to a shared preset.</li>
        <li>Change a shared preset only when all its consumers should follow. Select another preset or use native CSS for a deliberate local exception.</li>
        <li>Define new presets before use. Unknown references are errors; check existing presets before adding a duplicate.</li>
        <li>Use the shared generator and inspector for runtime and previews. Update source configuration rather than hand-editing generated CSS.</li>
        <li>Verify just below, at and just above transitions, intermediate persistence, multiple consumers, states, themes, clipping, focus visibility and invalid-update recovery.</li>
      </ul>
      <p><strong>Decision rule:</strong> Choose the shared Shadow treatment in the component. Define its appearance and responsive progression in the theme. Use local CSS for intentional exceptions.</p>
      <h3>Agent reasoning example</h3>
      <p>For “make only this card less elevated,” inspect the actual preset values and choose an appropriate existing treatment for that card; leave the shared definition intact. For “soften shadow-2 across the product,” edit that preset, preserve its layers and references, apply the theme and inspect every affected consumer and breakpoint.</p>
    </AgentGuidance>
  </>
}
