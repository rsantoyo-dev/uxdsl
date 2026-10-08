
const definition = `.card {
  border: border(1);
  border-radius: radius(2);
}`
const equivalent = `.card {
  border: 1px solid #64748b;
  border-radius: 8px;
}
@media (min-width: 768px) {
  .card {
    border: 2px solid #64748b;
    border-radius: 12px;
  }
}`

export default function BorderDocumentation() {
  return <div className="doc-section">
    <section aria-labelledby="borders-explained">
      <h2 id="borders-explained">Define shared edges and corners. Select them in components.</h2>
      <p><strong>Borders define the edge; Radii define the corner shape.</strong> A border preset combines width, style and color. A radius preset defines corner rounding. Either can include a responsive progression, but neither has to change with viewport width. Standard CSS remains available for deliberate local exceptions.</p>
      <h3>Where these definitions live today</h3>
      <p>Define <code>borders</code> and <code>radii</code> in the theme JSON. PostCSS, runtime theme generation and the preview use the same compiler and responsive resolver. Both plain CSS values and responsive progressions are supported.</p>
      <p>Pass the effective theme JSON to the build and runtime. The theme JSON is the only source of a preset: a <code>@theme</code> block in a stylesheet fails as <code>UXD_THEME_BLOCK_REMOVED</code>, naming the family its contents belong to, and nothing leaks from one compilation into another. The built-in presets come from <code>uxdsl/theme/base.json</code>. Inspect the definitions instead of assuming a preset number is a pixel value.</p>
      <h3>One definition, multiple consumers</h3>
      <pre><code className="language-json">{`{
  "breakpoints": { "xs": 0, "md": 768 },
  "radii": { "2": "xs(8px) md(12px)" },
  "borders": { "1": "xs(1px solid #64748b) md(2px solid #64748b)" }
}`}</code></pre>
      <p>This illustrative example uses <code>xs: 0</code> and <code>md: 768</code>. It uses literal values to isolate the behavior; shared definitions can also reference configured Spacing and Palette tokens.</p>
      <div className="doc-section__comparison">
        <div><h4>UXDSL</h4><pre><code className="language-css">{definition}</code></pre></div>
        <div><h4>Equivalent CSS behavior</h4><pre><code className="language-css">{equivalent}</code></pre></div>
      </div>
      <p>Below 768px, the card has a 1px border and 8px corners. At 768px and above, it has a 2px border and 12px corners. The most recent applicable value persists until another rule overrides it. Reusing the presets on another component shares that progression. The component consumes variables such as --uxdsl__border__1 and --uxdsl__radius__2. Edit and rebuild the source theme, or replace the managed theme stylesheet through generateThemeCss(nextTheme), to update consumers. The plain CSS example isolates the equivalent visual behavior.</p>
      <h3>Connect edges to the design system</h3>
      <pre><code className="language-json">{`{
  "radii": { "2": "xs(space(2)) md(space(3))" },
  "borders": { "1": "xs(1px solid palette(primary.main))" }
}`}</code></pre>
      <p>Spacing supplies reusable measurements; Palette supplies a semantic color role. A 1px hairline can intentionally remain stable. Prefer Density for component spacing, but do not automatically apply Density to border widths or corner radii: choose the intended edge and shape behavior.</p>
      <h3>Radius keywords</h3>
      <div className="doc-section__table-wrap"><table>
        <thead><tr><th>Expression</th><th>Current compiler result</th></tr></thead>
        <tbody>
          <tr><td><code>radius(2)</code></td><td>The configured radius-2 preset</td></tr>
          <tr><td><code>radius(pill)</code></td><td>9999px</td></tr>
          <tr><td><code>radius(circle)</code></td><td>50%; a circle requires equal width and height</td></tr>
        </tbody>
      </table></div>
      <p>One name per concept: <code>radius()</code> is the function and <code>pill</code>/<code>circle</code> the keywords; the former <code>rounded()</code> alias and <code>radius(full)</code> fail as <code>UXD_SYNTAX_REMOVED</code>, naming what to write. Keywords are built-in values, not references to editable numbered presets. Rounding a box does not itself clip overflowing child content.</p>
      <h3>A local exception should remain local</h3>
      <pre><code className="language-css">{`.selected-card {
  border: border(1);
  border-color: palette(primary.main);
  border-style: dashed;
  border-radius: radius(2);
}`}</code></pre>
      <p>Put explicit longhand overrides after the shorthand. The shared engine now changes the preset variable across breakpoints, rather than emitting a new shorthand in the component, so these local overrides persist. Currently, when a numbered Border preset exists, <code>border(1, palette(primary.main), dashed)</code> selects that complete preset and ignores the optional color/style arguments. Use the longhand form above for a deliberate local override.</p>
      <p>Change a shared Border when all its consumers should change their edge. Change a shared Radius when all its consumers should change their corners. For one component, select another suitable existing preset or use explicit CSS. Preserve the reference instead of copying its current computed value.</p>
      <h3>What the interactive demo changes</h3>
      <p>The editor below reads the active theme and shared defaults. It generates scoped CSS and reports resolved token references using the same engine as PostCSS and runtime. Edits affect only this preview and do not save your source JSON. Invalid updates retain the last valid preview. Reset restores the active theme; resize the real browser to inspect transitions.</p>
    </section>
  </div>
}
