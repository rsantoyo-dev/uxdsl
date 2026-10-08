
const theme = `{
  "breakpoints": { "xs": 0, "md": 768, "xl": 1280 },
  "spacing": { "7": "1.75rem", "8": "2rem", "10": "2.5rem" },
  "fonts": { "families": { "ui": "Inter, sans-serif" } },
  "typography_details": {
    "default": {
      "fontFamily": "var(--uxdsl__font__ui)",
      "fontWeight": "400",
      "lineHeight": "1.5"
    },
    "h1": {
      "fontSize": "xs(space(7)) md(space(8)) xl(space(10))",
      "fontWeight": "700",
      "lineHeight": "xs(1.2) md(1.3)"
    }
  }
}`
const usage = `.page-title {
  @ds-typo(h1);
}`
const css = `/* Equivalent size behavior, shown in isolation */
.page-title { font-size: 1.75rem; }
@media (min-width: 768px) {
  .page-title { font-size: 2rem; }
}
@media (min-width: 1280px) {
  .page-title { font-size: 2.5rem; }
}`

export default function TypographyDocumentation() {
  return <div className="doc-section">
    <section aria-labelledby="typography-system">
      <h2 id="typography-system">Define the text style once. Let the system adapt it.</h2>
      <p>Typography is a configured text style with responsive behavior. A component chooses a style such as <code>h1</code>; the theme defines its size, weight, line height and other properties across breakpoints. Like Density, it keeps shared responsive decisions in the system.</p>
      <p><strong>Spacing defines values. Density defines responsive spacing. Typography defines responsive text styles.</strong> Typography can use Spacing tokens without forcing the same progression as Density. Native CSS remains available for intentional exceptions.</p>
      <h3>The source is the theme JSON</h3>
      <p>This illustrative theme defines the complete progression. Omitted built-in breakpoint names retain the library defaults; custom names can also be configured.</p>
      <pre><code className="language-json">{theme}</code></pre>
      <p><code>typography_details.default</code> supplies missing fields to each configured style. A style’s own field replaces that default field as a whole; it does not merge individual breakpoint expressions. A responsive field needs a base value. The most recent applicable rule remains active until another breakpoint overrides it.</p>
      <div className="doc-section__table-wrap"><table>
        <caption>How this h1 behaves</caption>
        <thead><tr><th>Viewport</th><th>Font size</th><th>Line height</th></tr></thead>
        <tbody><tr><td>Below 768px</td><td>space(7) → 1.75rem</td><td>1.2</td></tr><tr><td>768px to below 1280px</td><td>space(8) → 2rem</td><td>1.3</td></tr><tr><td>1280px and above</td><td>space(10) → 2.5rem</td><td>1.3, inherited from md</td></tr></tbody>
      </table></div>
      <h3>Choose a style in the component</h3>
      <div className="doc-section__comparison"><div><h4>UXDSL</h4><pre><code className="language-css">{usage}</code></pre></div><div><h4>Pure CSS: the size progression</h4><pre><code className="language-css">{css}</code></pre></div></div>
      <p>The mixin consumes CSS variables such as <code>--uxdsl__typography__h1-font-size</code> and <code>--uxdsl__typography__h1-line-height</code>. The compiler generates their responsive definitions from the JSON. Pure CSS can centralize the same behavior with variables and media queries; UXDSL provides the reusable configuration and compilation layer.</p>
      <p>Keep HTML semantics independent of visual styling: use the appropriate heading level for the document, even when its visual style comes from another Typography role. Custom configured names, such as <code>label</code>, can also be consumed with <code>@ds-typo(label)</code>.</p>
      <h3>Change the system, update its consumers</h3>
      <ul><li>Change a Typography progression to update every component consuming that style.</li><li>Change a Spacing token to update its direct consumers and the Typography or Density definitions referencing it.</li><li>Change a breakpoint threshold to move transitions using that name.</li><li>Choose another configured style or use a deliberate local CSS override when only one component should change.</li></ul>
      <h3>One generator for build time and runtime</h3>
      <p>PostCSS accepts the JSON as its <code>theme</code> option. SSR and browser applications use <code>generateThemeCss(theme)</code> from <code>uxdsl/theme</code>. Both call the same Typography generator. For live changes, regenerate and replace the managed theme stylesheet rather than appending overrides:</p>
      <pre><code className="language-ts">{`import { generateThemeCss } from 'uxdsl/theme'

// themeStyle is the application's existing managed <style> element.
// Generate first so an invalid update cannot clear the active stylesheet.
const css = generateThemeCss(nextTheme)
themeStyle.textContent = css`}</code></pre>
      <p>The playground edits the JSON and applies this same generator. Its breakpoint buttons inspect a simulated viewport width using the shared resolver; they do not resize the browser. Default mode follows the actual viewport.</p>
      <h3>Supported fields and validation</h3>
      <p>Configured fields are <code>fontFamily</code>, <code>fontSize</code>, <code>lineHeight</code>, <code>fontWeight</code>, <code>letterSpacing</code>, <code>textTransform</code>, <code>textDecoration</code>, <code>fontStyle</code>, <code>marginBlockStart</code> and <code>marginBlockEnd</code>. Each accepts a nonempty string containing a CSS value or a configured responsive progression.</p>
      <p>The shared compiler checks role names, fields, base values and breakpoint widths. It preserves nested CSS expressions and Spacing references. It does not yet validate every CSS value, token dependency or accessibility requirement. Legacy flat <code>typography</code> variables remain supported; use <code>typography_details</code> for structured responsive styles.</p>
    </section>
  </div>
}
