import AgentGuidance from '../AgentGuidance'

const usage = `.page-title {
  @ds-typo(h1);
}`

export function TypographyAgentGuidance() {
  return <>
    <AgentGuidance id="ai-typography-guide" title="How an AI agent should use Typography">
      <p><strong>Responsibility: maintain shared text roles and their responsive behavior.</strong> Typography defines reusable visual text styles; components select the appropriate role without hardcoding the resolved values. HTML preserves document semantics.</p>
      <p>Typography is the preferred shared abstraction for text styling. <strong>Preserve intent, not just the current computed value.</strong> Keep the configured role and its responsive behavior intact, just as you would preserve a Density token or a semantic Palette reference.</p>
      <ul>
        <li>Inspect <code>typography_details</code>, its <code>default</code> fields, referenced <code>fonts</code>, <code>spacing</code>, and <code>breakpoints</code> before choosing or modifying a style. Treat these references as dependencies; inspect them without assuming they need to change.</li>
        <li>Reuse an appropriate configured style with <code>@ds-typo(role)</code>. Do not invent undefined roles or tokens.</li>
        <li>Do not replace a Typography reference with a fixed font size merely because both look identical at the current breakpoint.</li>
        <li>Keep semantic HTML appropriate to the document hierarchy; visual size does not determine the heading level.</li>
        <li>Modify a shared style only when all its consumers should receive the change. Use a deliberate local rule for an isolated exception.</li>
        <li>Preserve native CSS, units and token references when editing JSON. Do not convert unitless line height to pixels.</li>
        <li>Use the shared generator and resolver. Do not recreate breakpoint parsing or write generated CSS as the source of truth.</li>
        <li>Check just below, at and just above each configured breakpoint. Verify wrapping, zoom, font loading and other consumers of changed styles.</li>
      </ul>
      <p><strong>Decision rule:</strong> Choose the configured Typography role in the component. Define and evolve its visual and responsive behavior in the theme. Use local CSS only for intentional exceptions.</p>
      <h3>Example: preserve the shared role</h3>
      <pre><code className="language-css">{usage}</code></pre>
      <p>The component selects the <code>h1</code> typography role. The theme controls its font family, weight, line height, spacing references and responsive size progression.</p>
      <p>Avoid copying the currently resolved values when the component is intended to remain connected to the shared Typography role:</p>
      <pre><code className="language-css">{`.page-title {
  font-size: 2rem;
  line-height: 1.2;
}`}</code></pre>
      <p>These local values no longer follow changes to the shared role. They are appropriate only when that independence is an intentional exception.</p>
      <h3>Agent reasoning example</h3>
      <blockquote>Make page titles follow the application’s responsive typography.</blockquote>
      <ol><li>Inspect the existing title styles and their responsive mappings.</li><li>Choose the appropriate configured style, such as <code>h1</code>.</li><li>Apply <code>@ds-typo(h1)</code> to the title selector while preserving appropriate HTML semantics.</li><li>Verify the full progression instead of copying the font size visible on one screen.</li></ol>
    </AgentGuidance>
  </>
}
