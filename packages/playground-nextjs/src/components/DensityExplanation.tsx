'use client'

import styles from './DensityExplanation.module.css'

const theme = `{
  "breakpoints": { "xs": 0, "md": 768, "xl": 1280 },
  "spacing": {
    "4": "0.75rem",
    "5": "1rem",
    "6": "1.5rem"
  },
  "densities": {
    "4": "xs(space(4)) md(space(5)) xl(space(6))"
  }
}`

const uxdsl = `.card, .panel {
  padding: density(4);
}`

const css = `/* Base spacing tokens from the theme */
:root {
  --space-4: 0.75rem;
  --space-5: 1rem;
  --space-6: 1.5rem;
  --density-4: var(--space-4);
}

@media (min-width: 768px) {
  :root { --density-4: var(--space-5); }
}

@media (min-width: 1280px) {
  :root { --density-4: var(--space-6); }
}

.card, .panel {
  padding: var(--density-4);
}`

export default function DensityExplanation({ definition, onEdit }: {
  definition: string
  onEdit: () => void
}) {
  return (
    <div className={styles.explanation}>
      <section>
        <h3>One token. Responsive spacing everywhere.</h3>
        <p>A Density token maps a level to spacing values at different breakpoints. The <code>4</code> in <code>density(4)</code> identifies a token; it does not mean four pixels or a multiplier. You define its progression.</p>
        <h4>1. Define the behavior in your theme JSON</h4>
        <p>This example is a theme excerpt. Density reuses the spacing scale instead of introducing a separate set of measurements.</p>
        <pre className={styles.code}><code>{theme}</code></pre>
        <div className={styles.tableWrap}>
          <table>
            <caption>How this example resolves at each viewport width</caption>
            <thead><tr><th>Viewport</th><th>density(4)</th><th>space(4)</th></tr></thead>
            <tbody>
              <tr><td>Below 768px</td><td>space(4) → 0.75rem</td><td>0.75rem</td></tr>
              <tr><td>768–1279px</td><td>space(5) → 1rem</td><td>0.75rem</td></tr>
              <tr><td>1280px and above</td><td>space(6) → 1.5rem</td><td>0.75rem</td></tr>
            </tbody>
          </table>
        </div>
        <p>A rule remains active until another defined breakpoint overrides it. The progression is configurable: spacing can increase, decrease or stay the same.</p>
      </section>

      <section>
        <h4>2. Use it in your components</h4>
        <div className={styles.comparison}>
          <div><h5>UXDSL you write</h5><pre className={styles.code}><code>{uxdsl}</code></pre>
            <p>The card and panel choose a token. Its responsive behavior lives in the theme.</p></div>
          <div><h5>Equivalent plain CSS</h5><pre className={styles.code}><code>{css}</code></pre></div>
        </div>
        <p>You can build this same behavior in plain CSS using responsive custom properties. UXDSL generates those rules from the theme, so you maintain one mapping instead of repeating breakpoint decisions in each component. Less repeated source code does not necessarily mean less generated CSS.</p>
      </section>

      <section>
        <h4>3. Change one token. Update both boxes.</h4>
        <p>These live boxes use this page’s current theme and actual browser viewport. The colored area is padding. Edit the active rule for Density 4 to see both responsive boxes change; the fixed box continues to use <code>space(4)</code>.</p>
        <p className={styles.definition}><strong>Live density(4):</strong> <code>{definition}</code></p>
        <button type="button" className={styles.edit} onClick={onEdit}>Edit density(4)</button>
        <div className={styles.boxes}>
          {['Card', 'Panel', 'Fixed spacing'].map((name, index) => (
            <figure key={name}>
              <figcaption><strong>{name}</strong><code>padding: {index === 2 ? 'space(4)' : 'density(4)'}</code></figcaption>
              <div className={index === 2 ? styles.fixed : styles.responsive}
                style={{ padding: index === 2 ? 'var(--space-4)' : 'var(--density-4)' }}>
                <div className={styles.content}>Content</div>
              </div>
            </figure>
          ))}
        </div>
        <p>Resize your browser to see the responsive boxes follow the mapping. The JSON and CSS above remain a reference example; the live definition shows your edits. Edits are a local demo and are not saved to your theme file.</p>
        <p><strong>Two ways to update the system:</strong> change a spacing value to update every reference to that spacing token, or change a Density mapping to update every consumer of that Density token. Component declarations stay the same.</p>
        <p>Use <code>space()</code> when spacing should stay constant across breakpoints, and <code>density()</code> when it should follow a shared responsive rule. Density coordinates spacing; layout changes such as columns and navigation still need their own responsive decisions.</p>
      </section>
    </div>
  )
}
