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
      "main": "var(--uxdsl__color__blue-700)",
      "contrast": "var(--uxdsl__color__white)"
    },
    "surface": {
      "main": "var(--uxdsl__color__white)",
      "contrast": "var(--uxdsl__color__ink)"
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
      <p>The nested entry <code>{'colors.blue["700"]'}</code> produces <code>--uxdsl__color__blue-700</code>. The nested role <code>palette.primary.main</code> produces <code>--uxdsl__palette__primary-main</code>.</p>
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
  --uxdsl__color__blue-700: #1d4ed8;
  --uxdsl__color__white: #ffffff;
  --uxdsl__palette__primary-main: var(--uxdsl__color__blue-700);
  --uxdsl__palette__primary-contrast: var(--uxdsl__color__white);
}

.primary-action {
  background: var(--uxdsl__palette__primary-main);
  color: var(--uxdsl__palette__primary-contrast);
}
.blue-swatch {
  background: var(--uxdsl__color__blue-700);
}`}</code></pre></div>
      </div>
      <p>The CSS shows only the variables used by these two selectors. Plain CSS custom properties provide the same reference mechanism; UXDSL connects component syntax to the theme’s shared definitions.</p>
      <h3>3. Choose the scope of the change</h3>
      <ul>
        <li><strong>Update a color value:</strong> change <code>{'colors.blue["700"]'}</code> to update direct consumers and palette roles that reference it.</li>
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
      {topic === 'colors' ? <>
        <p><strong>Responsibility: maintain the foundational color collection.</strong> Colors supply values to direct consumers and linked palette roles. Normally, semantic UI components consume Palette rather than selecting Colors directly.</p>
        <ul>
          <li>Inspect <code>colors</code> and its families, shades and named entries. Treat shade numbers as keys, not calculated brightness or contrast guarantees.</li>
          <li>Use <code>color(token)</code> directly only when a specific color identity is intentional, such as a swatch representing that token.</li>
          <li>Before changing a Color value, trace direct <code>color()</code> consumers, CSS variable references and runtime links from Palette. Equal hex values alone do not establish a dependency.</li>
          <li>Update the base Color only when all its direct and linked consumers are intended to receive the change. If the request concerns a UI role, reassign that Palette role instead.</li>
          <li>Preserve explicit references from Palette to Colors. Do not replace them with copied hex values when the link should remain active.</li>
          <li>Reuse existing Color tokens and define any required new token before referencing it. Do not create a duplicate merely to reproduce an existing value.</li>
          <li>Edit the source JSON or use the supported Color runtime API. Do not hand-edit generated CSS as a second source of truth.</li>
          <li>Verify direct swatches and linked roles after applying the change. Check active overrides, unrelated tokens and foreground/background pairs affected by the new base value.</li>
        </ul>
        <p><strong>Decision rule:</strong> Prefer Palette for semantic component styling. Use Colors directly only when a specific color identity is intentional. Modify a Color token only when its direct and linked consumers are intended to receive the change.</p>
      </> : <>
        <p><strong>Responsibility: maintain the semantic roles consumed by UI components.</strong> Palette expresses purpose, such as primary action or surface, independently of the current color assigned to it.</p>
        <ul>
          <li>Inspect <code>palette</code>, relevant mode overrides and component conventions before choosing a role and variant. Primary does not inherently mean blue.</li>
          <li>Prefer <code>palette(role.variant)</code> when styling interface roles. Confirm the role, variant and any referenced Color exist in the intended theme.</li>
          <li>Do not replace a Palette reference with a Color reference merely to reproduce the current visual result. Preserve the semantic layer when the component expresses a UI role.</li>
          <li>Reassign a Palette role when its meaning stays the same but its visual color should change. Keep components connected to the role rather than rewriting their color declarations.</li>
          <li>Use explicit CSS variable references in JSON when a role should follow a Color token. A literal color is independent; matching a Color token’s hex value does not link them.</li>
          <li>For a change limited to one component, select an appropriate existing role or a deliberate local exception. Do not reassign a shared role unless its other consumers should change.</li>
          <li>Update the Palette definition in the source theme or through its supported runtime API. Review mode-specific assignments so they preserve the intended role.</li>
          <li>Verify consumers of the reassigned role, interaction states and modes. Confirm direct Color consumers remain unchanged. Check the actual foreground/background contrast; the variant name <code>contrast</code> is not automatic validation.</li>
        </ul>
        <p><strong>Decision rule:</strong> Prefer Palette when styling interface roles. Reassign a Palette role when the meaning stays the same but its visual color should change. Keep components connected to the role.</p>
      </>}
      <p><strong>Preserve intent, not just the current computed value.</strong> A Palette role and a Color token can look identical today while responding differently to tomorrow’s theme changes.</p>
      <h3>Configuration and usage example</h3>
      <pre><code className="language-json">{theme}</code></pre>
      <pre><code className="language-css">{topic === 'colors' ? `/* A swatch intentionally represents this Color token */
.blue-swatch {
  background: color(blue-700);
}` : `.primary-action {
  background: palette(primary.main);
  color: palette(primary.contrast);
}`}</code></pre>
      {topic === 'colors'
        ? <p>The swatch intentionally consumes <code>blue-700</code> directly. In the JSON, <code>primary.main</code> also references that Color. Updating the Color changes both; reassigning the Palette role changes its consumers while the swatch keeps representing <code>blue-700</code>.</p>
        : <p>The action consumes <code>primary.main</code>, which currently references <code>blue-700</code>. Reassign the role to another defined Color to update its consumers while keeping their semantic declarations intact.</p>}
      <h3>Agent reasoning example</h3>
      {topic === 'palette' ? <>
        <blockquote>Change primary actions to use the existing blue-500 color.</blockquote>
        <ol>
          <li>Confirm <code>blue-500</code> exists and inspect the primary role, its consumers and mode overrides.</li>
          <li>Update <code>palette.primary.main</code> to <code>var(--uxdsl__color__blue-500)</code> in the intended theme scope.</li>
          <li>Keep components using <code>palette(primary.main)</code>; leave direct blue-700 references unchanged.</li>
          <li>Apply the theme and verify affected actions, states and modes. Recheck the contrast foreground and adjust its definition if the design requires it.</li>
        </ol>
      </> : <>
        <blockquote>Update blue-700 across the theme, including palette roles linked to it.</blockquote>
        <ol>
          <li>Locate <code>{'colors.blue["700"]'}</code>, its direct consumers, and palette references to it.</li>
          <li>Update the color value in the source JSON, preserving palette references rather than replacing them with copied hex values.</li>
          <li>Apply or compile the theme. Confirm that direct swatches and linked roles receive the new value.</li>
          <li>Check unrelated color tokens, literal palette values, relevant modes and foreground/background contrast.</li>
        </ol>
      </>}
      <p><em>Colors define the values. Palette defines their roles. Components express the intended use.</em></p>
    </AgentGuidance>
  )
}
