import styles from './SpacingExplanation.module.css'
import SpacingPrinciple from './SpacingPrinciple'

export default function SpacingExplanation() {
  return (
    <section className={styles.explanation} aria-labelledby="spacing-explained">
      <h2 id="spacing-explained">One spacing scale. Consistent decisions everywhere.</h2>
      <SpacingPrinciple />
      <p>Spacing tokens are named entries in your theme’s spacing scale. Use them for padding inside a box, margins around it, and gaps between items. Components choose a token; the theme supplies its value.</p>
      <p><code>space(4)</code> references entry <code>4</code>. It does not mean four pixels or four times a base unit. The theme defines the measurement.</p>
      <h3>1. Define the scale in your theme JSON</h3>
      <p>This reference excerpt defines three reusable values:</p>
      <pre><code className="language-json">{`{
  "spacing": {
    "2": "0.25rem",
    "4": "0.75rem",
    "6": "1.5rem"
  }
}`}</code></pre>
      <h3>2. Use Spacing directly when stable spacing is intentional</h3>
      <p>In this example, the card padding and actions gap intentionally keep the same spacing value across breakpoints. For ordinary component spacing, prefer an appropriate Density token.</p>
      <div className={styles.comparison}>
        <div><h4>UXDSL you write</h4><pre><code className="language-css">{`.card, .panel {
  padding: space(4);
}

.actions {
  display: flex;
  gap: space(4);
}`}</code></pre></div>
        <div><h4>Equivalent plain CSS</h4><pre><code className="language-css">{`:root {
  --space-2: 0.25rem;
  --space-4: 0.75rem;
  --space-6: 1.5rem;
}

.card, .panel {
  padding: var(--space-4);
}

.actions {
  display: flex;
  gap: var(--space-4);
}`}</code></pre></div>
      </div>
      <p>Plain CSS custom properties can provide the same reuse. UXDSL expresses those references through the theme’s token vocabulary. The benefit is maintaining shared values instead of repeating measurements throughout the application.</p>
      <h3>3. Update the value once</h3>
      <p>Change spacing entry <code>4</code> from <code>0.75rem</code> to <code>1rem</code>. When the updated theme is compiled or applied through the runtime, every consumer of <code>space(4)</code> receives that value without changing its declaration. This includes Density rules wherever they resolve to <code>space(4)</code>.</p>
      <h3>Density by default, Spacing for deliberate control</h3>
      <p>Start with an appropriate <code>density(n)</code> token for component spacing. Use <code>space(n)</code> directly when a stable spacing value is intentional. Direct Spacing still belongs to the design system; it bypasses the Density progression. Matching token numbers or matching values at one breakpoint do not make the two interchangeable.</p>
      <p><strong>Stable across breakpoints does not mean permanently fixed:</strong> <code>space()</code> does not add responsive rules itself. Its result still follows the theme value, CSS units and any deliberate overrides. For example, <code>rem</code> follows the root font size; a configured <code>clamp()</code> can vary with the viewport.</p>
      <p>For shared responsive spacing, see <a href="/docs/densities">Density</a>. Keep explicit local responsive rules for intentional component exceptions.</p>
    </section>
  )
}
