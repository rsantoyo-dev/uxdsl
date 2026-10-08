import AgentGuidance from '../AgentGuidance'


export function BorderAgentGuidance() {
  return <>
    <AgentGuidance id="ai-borders-guide" title="How an AI agent should use Borders">
      <p><strong>Responsibility: maintain shared edge treatments.</strong> Borders combine width, style and color. Components select a preset; Palette can preserve the semantic color dependency.</p>
      <ul>
        <li>Inspect the effective theme JSON, configured breakpoints and referenced Spacing or Palette tokens before choosing a Border.</li>
        <li>Reuse an existing <code>border(n)</code> preset when its complete treatment matches the intent. Do not interpret n as a pixel width.</li>
        <li>Do not replace a preset with its resolved shorthand merely because both look identical now.</li>
        <li>For a local color or style exception, place CSS longhands after the Border declaration. <code>border()</code> takes the preset key only: a second argument is <code>UXD_EDGE_ARGUMENT</code>.</li>
        <li>Modify the shared definition only when all consumers should change. Trace dependent color and spacing tokens before changing foundational values.</li>
        <li>Define new presets before use. Unknown references now report errors instead of silently inventing fallback values. Existing literal CSS values remain valid.</li>
        <li>Rebuild and check breakpoint boundaries, box sizing, content area, layout shifts, states and edge contrast. Keep accessible focus indicators.</li>
      </ul>
      <p><strong>Decision rule:</strong> Choose a shared Border for a shared edge treatment. Use local longhands for intentional exceptions. Change the theme only for a shared change.</p>
      <h3>Agent reasoning example</h3>
      <p>For “make only the selected card&apos;s border dashed,” retain its preset and add a local dashed style after it. The shared variable changes do not reset that longhand. Check its responsive widths and confirm unselected cards keep their existing style.</p>
    </AgentGuidance>
    <AgentGuidance id="ai-radii-guide" title="How an AI agent should use Radii">
      <p><strong>Responsibility: maintain shared corner shapes and their responsive behavior.</strong> Preserve intent, not just the current computed value.</p>
      <ul>
        <li>Inspect the theme&apos;s <code>radii</code> definitions, breakpoints and any referenced Spacing tokens. Reuse an appropriate configured preset.</li>
        <li>Keep <code>radius(n)</code> when a component belongs to the shared shape system. Do not substitute the value observed at one viewport.</li>
        <li>Use <code>radius(pill)</code> for the built-in 9999px treatment and <code>radius(circle)</code> for 50%. Check dimensions; a rectangular box with 50% rounding is not a circle.</li>
        <li>Change the shared Radius only when all its consumers should follow. Select another preset or use intentional per-corner CSS for a local exception.</li>
        <li>The compiler rejects unknown radius references instead of inventing a fallback ramp. Define numbered presets explicitly and verify their dependencies.</li>
        <li>Rebuild and inspect breakpoint boundaries, nested corners, images, overflow, focus outlines and different aspect ratios.</li>
      </ul>
      <p><strong>Decision rule:</strong> Choose a configured Radius for shared corner styling. Define its progression in the theme. Use native CSS for deliberate independent shapes.</p>
      <h3>Agent reasoning example</h3>
      <p>For “make every card using radius-2 rounder on desktop,” inspect all consumers and the configured desktop threshold, update that preset&apos;s progression, rebuild and verify mobile, boundary widths and desktop. Keep components using <code>radius(2)</code>.</p>
    </AgentGuidance>
  </>
}
