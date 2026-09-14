import AgentGuidance from './AgentGuidance'
import styles from './ColorDocumentation.module.css'

type Topic = 'colors' | 'palette'

const theme = `{
  "colors": {
    "blue": { "500": "#3b82f6", "700": "#1d4ed8" },
    "white": "#ffffff",
    "ink": "#0f172a"
  },
  "palette": {
    "primary": {
      "main": "var(--ds__color__blue-700)",
      "contrast": "var(--ds__color__white)"
    },
    "surface": {
      "main": "var(--ds__color__white)",
      "contrast": "var(--ds__color__ink)"
    }
  }
}`

function ColorPrinciple() {
  return <p>UXDSL builds on standard CSS. <strong>Colors define the available color values; Palette assigns colors to interface roles.</strong> Both are configured in the theme JSON. Prefer <code>palette()</code> when a component expresses a role such as primary action or surface. Use <code>color()</code> when a specific color token is intentional, and standard CSS when finer control is needed.</p>
}

export function ColorExplanation({ topic }: { topic: Topic }) {
  const isPalette = topic === 'palette'
  return (
    <section className={styles.explanation} aria-labelledby={`${topic}-explained`}>
      <h2 id={`${topic}-explained`}>{isPalette ? 'Give colors a role in your UI.' : 'Define your colors once. Build palettes from them.'}</h2>
      <ColorPrinciple />
      <p>{isPalette ? 'A palette describes what a color is used for. Primary does not have to mean blue: another theme can assign a different color while components keep the same role.' : 'Colors are a collection of reusable color values. You can organize them into families and shades, or define individual named entries. The shade number is a key, not a computed brightness or a guarantee of contrast.'}</p>
      <h3>1. Define Colors and Palette in the theme JSON</h3>
      <p>This reference excerpt defines a color collection and connects palette roles to it using CSS variable references:</p>
      <pre><code className="language-json">{theme}</code></pre>
      <p>The nested entry <code>colors.blue["700"]</code> produces <code>--ds__color__blue-700</code>. The nested role <code>palette.primary.main</code> produces <code>--ds__palette__primary-main</code>.</p>
      <p><strong>References preserve the connection.</strong> In this JSON, <code>primary.main</code> references <code>blue-700</code>. Changing that color updates the role once the theme is compiled or applied. A literal hex value in a palette is also valid, but copying a color’s hex value does not create a reference to that color token.</p>
      <h3>2. Express the intended role in components</h3>
      <div className={styles.comparison}>
        <div><h4>UXDSL you write</h4><pre><code className="language-css">{`.primary-action {
  background: palette(primary.main);
  color: palette(primary.contrast);
}

/* Deliberately use a specific color token */
.blue-swatch {
  background: color(blue-700);
}`}</code></pre></div>
        <div><h4>Equivalent plain CSS</h4><pre><code className="language-css">{`:root {
  --ds__color__blue-700: #1d4ed8;
  --ds__color__white: #ffffff;
  --ds__palette__primary-main: var(--ds__color__blue-700);
  --ds__palette__primary-contrast: var(--ds__color__white);
}

.primary-action {
  background: var(--ds__palette__primary-main);
  color: var(--ds__palette__primary-contrast);
}
.blue-swatch {
  background: var(--ds__color__blue-700);
}`}</code></pre></div>
      </div>
      <p>The CSS shows only the variables used by these two selectors. Plain CSS custom properties provide the same reference mechanism; UXDSL connects component syntax to the theme’s shared definitions.</p>
      <h3>3. Choose the scope of the change</h3>
      <ul>
        <li><strong>Update a color value:</strong> change <code>colors.blue["700"]</code> to update direct consumers and palette roles that reference it.</li>
        <li><strong>Reassign a role:</strong> change <code>palette.primary.main</code> to reference <code>blue-500</code>. Primary actions follow that role; direct <code>color(blue-700)</code> consumers keep their token.</li>
        <li><strong>Change one component:</strong> choose another appropriate existing role or color token in that component, without changing shared definitions.</li>
      </ul>
      <p>Apply changes through the theme build or supported runtime API. Existing overrides and active modes can affect the final value. A variant named <code>contrast</code> is a configured foreground color, not proof of accessible contrast; check the actual foreground/background pair in each relevant state and theme.</p>
      <h3>{isPalette ? 'Explore roles in the live playground' : 'Explore the live color collection'}</h3>
      <p>{isPalette ? 'Use the examples and palette editors below to inspect roles and their consumers. The reference JSON above stays unchanged. Palette edits may affect other parts of the playground that use the same role.' : 'The swatches and examples below show the playground’s color collection. Edit a color to inspect its direct consumers and any explicitly linked palette roles. The reference JSON above stays unchanged.'} Editor changes update the playground’s theme/runtime state; some controls persist browser overrides. They do not write to your source JSON file.</p>
      <p>{isPalette ? <a href="/docs/colors">Read Colors to understand the values behind palette roles.</a> : <a href="/docs/palette">Continue to Palette to assign colors to UI roles.</a>}</p>
    </section>
  )
}

export function ColorAgentGuidance({ topic }: { topic: Topic }) {
  const title = topic === 'palette' ? 'Palette' : 'Colors'
  return (
    <AgentGuidance id={`ai-${topic}-guide`} title={`How an AI agent should use ${title}`}>
      <ColorPrinciple />
      <p>When generating or modifying UI with UXDSL:</p>
      <ul>
        <li>Inspect <code>colors</code>, <code>palette</code>, relevant mode overrides, and existing component conventions in the active theme before selecting tokens.</li>
        <li>Prefer <code>palette(role.variant)</code> for semantic UI roles. Use <code>color(token)</code> when the design intentionally requires that specific color independently of a palette role.</li>
        <li>Do not infer a relationship from equal hex values. Inspect the reference or runtime link. In configuration JSON, use explicit CSS variable references when palette roles should follow color tokens.</li>
        <li>Do not assume that names such as primary mean blue, or that shade numbers imply specific values or contrast ratios.</li>
        <li>Reuse existing tokens. If a new system-level token is needed, define it before referencing it. Ensure every referenced color and palette variant exists.</li>
        <li>Change a color definition only when its direct and linked consumers should change. Reassign a palette role when the role should change while the color collection remains intact.</li>
        <li>For a local exception, change the component’s token choice or use deliberate CSS control instead of modifying unrelated shared roles.</li>
        <li>Edit source configuration or use supported runtime APIs. Do not maintain a second set of definitions by editing generated CSS.</li>
        <li>Verify computed colors, reference resolution, shared consumers, active modes and interaction states. Check foreground/background contrast; a token named contrast is not automatic validation.</li>
      </ul>
      <p><strong>Decision rule:</strong> Choose Palette for a UI role and Colors for a specific color. Change shared definitions only when the requested scope includes their consumers.</p>
      <h3>Configuration and usage example</h3>
      <pre><code className="language-json">{theme}</code></pre>
      <pre><code className="language-css">{`.primary-action {
  background: palette(primary.main);
  color: palette(primary.contrast);
}`}</code></pre>
      <p>Here the background resolves through <code>primary.main</code> to <code>blue-700</code>. Do not replace the role with <code>color(blue-700)</code> merely because the current appearance is identical; it would no longer follow future reassignment of the primary role.</p>
      <h3>Agent reasoning example</h3>
      {topic === 'palette' ? <>
        <blockquote>Change primary actions to use the existing blue-500 color.</blockquote>
        <ol>
          <li>Confirm <code>blue-500</code> exists and inspect the primary role, its consumers and mode overrides.</li>
          <li>Update <code>palette.primary.main</code> to <code>var(--ds__color__blue-500)</code> in the intended theme scope.</li>
          <li>Keep components using <code>palette(primary.main)</code>; leave direct blue-700 references unchanged.</li>
          <li>Apply the theme and verify affected actions, states and modes. Recheck the contrast foreground and adjust its definition if the design requires it.</li>
        </ol>
      </> : <>
        <blockquote>Update blue-700 across the theme, including palette roles linked to it.</blockquote>
        <ol>
          <li>Locate <code>colors.blue["700"]</code>, its direct consumers, and palette references to it.</li>
          <li>Update the color value in the source JSON, preserving palette references rather than replacing them with copied hex values.</li>
          <li>Apply or compile the theme. Confirm that direct swatches and linked roles receive the new value.</li>
          <li>Check unrelated color tokens, literal palette values, relevant modes and foreground/background contrast.</li>
        </ol>
      </>}
      <p><em>Colors define the values. Palette defines their roles. Components express the intended use.</em></p>
    </AgentGuidance>
  )
}
