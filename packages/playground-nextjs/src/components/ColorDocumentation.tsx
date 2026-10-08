
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
    <section className="color-documentation" aria-labelledby={`${topic}-explained`}>
      <h2 id={`${topic}-explained`}>{isPalette ? 'Give colors a role in your UI.' : 'Define your colors once. Build palettes from them.'}</h2>
      <ColorPrinciple />
      <p>{isPalette ? 'A palette describes what a color is used for. Primary does not have to mean blue: another theme can assign a different color while components keep the same role.' : 'Colors are a collection of reusable color values. You can organize them into families and shades, or define individual named entries. The shade number is a key, not a computed brightness or a guarantee of contrast.'}</p>
      <h3>1. Define Colors and Palette in the theme JSON</h3>
      <p>This reference excerpt defines a color collection and connects palette roles to it using CSS variable references:</p>
      <pre><code className="language-json">{theme}</code></pre>
      <p>The nested entry <code>{'colors.blue["700"]'}</code> produces <code>--uxdsl__color__blue-700</code>. The nested role <code>palette.primary.main</code> produces <code>--uxdsl__palette__primary-main</code>.</p>
      <p><strong>References preserve the connection.</strong> In this JSON, <code>primary.main</code> references <code>blue-700</code>. Changing that color updates the role once the theme is compiled or applied. A literal hex value in a palette is also valid, but copying a color’s hex value does not create a reference to that color token.</p>
      <h3>2. Express the intended role in components</h3>
      <div className="color-documentation__comparison">
        <div><h4>UXDSL you write</h4><pre><code className="language-css">{`.primary-action {
  background: palette(primary.main);
  color: palette(primary.contrast);
}

/* Deliberately use a specific color token */
.blue-swatch {
  background: color(blue.700);
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
        <li><strong>Reassign a role:</strong> change <code>palette.primary.main</code> to reference <code>blue-500</code>. Primary actions follow that role; direct <code>color(blue.700)</code> consumers keep their token.</li>
        <li><strong>Change one component:</strong> choose another appropriate existing role or color token in that component, without changing shared definitions.</li>
      </ul>
      <p>Apply changes through the theme build or supported runtime API. Existing overrides and active modes can affect the final value. A variant named <code>contrast</code> is a configured foreground color, not proof of accessible contrast; check the actual foreground/background pair in each relevant state and theme.</p>
      <h3>{isPalette ? 'Explore roles in the live playground' : 'Explore the live color collection'}</h3>
      <p>{isPalette ? 'Use the examples and palette editors below to inspect roles and their consumers. The reference JSON above stays unchanged. Palette edits may affect other parts of the playground that use the same role.' : 'The swatches and examples below show the playground’s color collection. Edit a color to inspect its direct consumers and any explicitly linked palette roles. The reference JSON above stays unchanged.'} Editor changes update the playground’s theme/runtime state; some controls persist browser overrides. They do not write to your source JSON file.</p>
      <p>{isPalette ? <a href="#colors-explained">Read Colors, above, for the values behind palette roles.</a> : <a href="#palette-explained">Continue to Palette, below, to assign colors to UI roles.</a>}</p>
    </section>
  )
}

