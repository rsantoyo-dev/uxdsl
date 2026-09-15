import AgentGuidance from './AgentGuidance'
import styles from './BreakpointDocumentation.module.css'

export default function ShadowDocumentation() {
  return <div className={styles.content}>
    <section aria-labelledby="shadows-explained">
      <h2 id="shadows-explained">Define shared depth. Let components choose the treatment.</h2>
      <p><strong>Responsibility: maintain shared shadow treatments and their responsive behavior.</strong> Shadows describe visual depth or an inset effect. A preset can contain several layers, remain stable or change across breakpoints. Its number is a key, not a pixel value, a z-index or a guarantee that higher numbers always look stronger.</p>
      <h3>Define Shadows in the theme JSON</h3>
      <pre><code className="language-json">{`{
  "breakpoints": { "xs": 0, "md": 768 },
  "shadows": {
    "0": "none",
    "2": "xs(0 2px 4px rgba(0, 0, 0, 0.12)) md(0 6px 16px rgba(0, 0, 0, 0.18))",
    "inset": "inset 0 1px 3px rgba(0, 0, 0, 0.2)"
  }
}`}</code></pre>
      <p>These are illustrative values. Inspect the active configuration and overrides. Shared defaults are supplied for omitted presets. Shadow 0 explicitly means no shadow. Each configured value can be plain CSS or a responsive progression with a base value.</p>
      <div className={styles.comparison}>
        <div><h4>UXDSL</h4><pre><code className="language-css">{`.card {
  box-shadow: shadow(2);
}
.inset-panel {
  box-shadow: shadow(inset);
}`}</code></pre></div>
        <div><h4>Equivalent CSS for the card</h4><pre><code className="language-css">{`:root { --uxdsl__shadow__2: 0 2px 4px rgba(0, 0, 0, 0.12); }
@media (min-width: 768px) {
  :root { --uxdsl__shadow__2: 0 6px 16px rgba(0, 0, 0, 0.18); }
}
.card { box-shadow: var(--uxdsl__shadow__2); }`}</code></pre></div>
      </div>
      <p>The component selects a preset. At 768px the shared variable changes; at later breakpoints that value persists until another override applies. This is a discrete transition, not automatic interpolation. <code>elevation(2)</code> is an alias for <code>shadow(2)</code>; neither changes stacking order.</p>
      <h3>Layers, inset effects and system references</h3>
      <pre><code className="language-json">{`{
  "shadows": {
    "3": "0 2px 4px rgba(0, 0, 0, 0.06), 0 4px 10px rgba(0, 0, 0, 0.14)"
  }
}`}</code></pre>
      <p>Preserve comma-separated layers and the commas inside color functions. A shadow describes offsets, blur, optional spread, color and optionally <code>inset</code>. Use the preset with <code>box-shadow</code>; do not assume its grammar is valid for <code>text-shadow</code> or <code>filter: drop-shadow()</code>.</p>
      <p>Presets may reference existing <code>space()</code>, <code>density()</code>, <code>color()</code> or <code>palette()</code> tokens. Keep those dependencies when intentional. Density is the preferred component spacing abstraction; shadow offsets and blur do not automatically need Density.</p>
      <h3>Change the correct scope</h3>
      <ul>
        <li>For one card, select another suitable existing Shadow preset.</li>
        <li>For all consumers of a shared treatment, edit its theme definition and rebuild or apply the updated theme through <code>generateThemeCss(nextTheme)</code>.</li>
        <li>For an intentional independent effect, use native CSS. Use <code>box-shadow: none</code> to remove a shadow locally, or <code>shadow(0)</code> to stay connected to the configured zero preset.</li>
      </ul>
      <p>Do not replace <code>shadow(2)</code> with today&apos;s computed value when the component should follow future theme changes. Changing the token updates every consumer after the configuration is applied. Inspect active overrides, clipping ancestors, backgrounds, focus indicators and interaction states.</p>
      <h3>One engine at build time, runtime and in the preview</h3>
      <p>PostCSS, runtime and the demo share the Shadow compiler and responsive resolver. Defaults are maintained in the shared module and emitted into <code>postcss-uxdsl/theme/default-shadows.uxdsl</code> by the generation script. The previous runtime supported literal values; responsive values now resolve through the same engine as PostCSS.</p>
      <pre><code className="language-css">{`/* Legacy input remains supported in the same compilation. */
@theme {
  shadow-2: xs(0 2px 4px rgba(0, 0, 0, 0.12)) md(0 6px 16px rgba(0, 0, 0, 0.18));
}`}</code></pre>
      <p>JSON entries override matching legacy declarations, which override defaults. Include legacy definitions in every compilation that needs them; they no longer leak between builds through a global cache. Undefined Shadow references now report errors instead of silently selecting a fallback. Validation is not a complete CSS grammar or accessibility checker.</p>
      <p>The live editor below starts from the active theme and shared defaults. Its changes affect only the preview, not your source JSON. It uses the real viewport and shared inspector. An invalid edit retains the last valid preview; Reset restores the active theme.</p>
    </section>
    <AgentGuidance id="ai-shadows-guide" title="How an AI agent should use Shadows">
      <p><strong>Responsibility: maintain shared depth treatments and their responsive behavior.</strong> Preserve intent, not just the current computed value.</p>
      <ul>
        <li>Inspect the effective <code>shadows</code> configuration, legacy imports, breakpoints and referenced color or spacing tokens before selecting a preset.</li>
        <li>Reuse an appropriate configured <code>shadow(key)</code> or <code>elevation(key)</code> for box shadows. Do not infer visual strength from a numeric key or confuse elevation with z-index.</li>
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
  </div>
}
