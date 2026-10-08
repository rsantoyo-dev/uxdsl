import AgentGuidance from '../AgentGuidance'

export function SurfaceAgentGuidance() {
  return <AgentGuidance id="ai-surfaces-guide" title="How an AI agent should use Surfaces">
    <p><strong>Responsibility: maintain shared container treatments by composing existing design-system roles and tokens.</strong> Preserve intent, not just the current computed value.</p>
    <ul>
      <li>Inspect the effective <code>surfaces</code> configuration, breakpoints and referenced Density, Radii, Palette, Borders and Shadows before selecting a role.</li>
      <li>Reuse a suitable configured role with <code>@ds-surface(role)</code>. Do not rebuild its six properties locally merely because the result looks identical today.</li>
      <li>Preserve token references. Surface radius references Radius, not Spacing; the Surface consumes that system&apos;s shape behavior.</li>
      <li>Use a tone only when an explicit Palette-family override is intended. Check which fields it overrides for the selected variant.</li>
      <li>Use the size argument only after checking both <code>density(n)</code> and <code>radius(n)</code>. Do not infer measurements from the numeric key.</li>
      <li>Change a shared Surface only when all its consumers should follow. Use a different role or subsequent local CSS for an intentional exception.</li>
      <li>Partial overrides inherit missing fields; replacing a field replaces its full responsive expression. Custom roles inherit contained defaults.</li>
      <li>Define roles and dependencies before use. Keep semantic HTML, layout and interaction behavior appropriate to the component.</li>
      <li>Use the shared generator and inspector; update source configuration instead of generated CSS or demo-only default maps.</li>
      <li>Verify breakpoint boundaries, intermediate persistence, nested containers, tone overrides, wrapping, border sizing, clipping, foreground contrast, focus visibility and all shared consumers.</li>
    </ul>
    <p><strong>Decision rule:</strong> Choose the container role in the component. Compose its shared visual decisions in the theme. Use optional arguments or native CSS only for deliberate overrides.</p>
    <h3>Agent reasoning example</h3>
    <p>For “make all contained cards less elevated on desktop,” inspect the contained role and its consumers, modify that role&apos;s shadow progression, apply the theme and verify each relevant breakpoint. Keep components using <code>@ds-surface(contained)</code>. For one exceptional card, retain the role and override its shadow locally.</p>
  </AgentGuidance>
}
