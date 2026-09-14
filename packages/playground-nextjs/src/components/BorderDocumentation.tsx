import AgentGuidance from './AgentGuidance'
import styles from './BreakpointDocumentation.module.css'

const definition = `@theme {
  radius-2: xs(8px) md(12px);
  border-1: xs(1px solid #64748b) md(2px solid #64748b);
}

.card {
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
  return <div className={styles.content}>
    <section aria-labelledby="borders-explained">
      <h2 id="borders-explained">Define shared edges and corners. Select them in components.</h2>
      <p><strong>Borders define the edge; Radii define the corner shape.</strong> A border preset combines width, style and color. A radius preset defines corner rounding. Either can include a responsive progression, but neither has to change with viewport width. Standard CSS remains available for deliberate local exceptions.</p>
      <h3>Where these definitions live today</h3>
      <p>Unlike the documented JSON configuration for Density and Typography, these primitives currently use <code>border-n</code> and <code>radius-n</code> declarations inside a UXDSL <code>@theme</code> block. The generic JSON runtime generator does not currently provide equivalent Borders and Radii sections. Do not assume that adding <code>borders</code> or <code>radii</code> to that JSON will generate these styles.</p>
      <p>Load the theme definitions before their consumers through the project&apos;s UXDSL build. The bundled files are <code>postcss-uxdsl/theme/default-borders.uxdsl</code> and <code>postcss-uxdsl/theme/default-radii.uxdsl</code>. Inspect the imported definitions instead of assuming a preset number is a pixel value.</p>
      <h3>One definition, multiple consumers</h3>
      <p>This illustrative example uses <code>xs: 0</code> and <code>md: 768</code>. It uses literal values to isolate the behavior; shared definitions can also reference configured Spacing and Palette tokens.</p>
      <div className={styles.comparison}>
        <div><h4>UXDSL</h4><pre><code className="language-css">{definition}</code></pre></div>
        <div><h4>Equivalent CSS behavior</h4><pre><code className="language-css">{equivalent}</code></pre></div>
      </div>
      <p>Below 768px, the card has a 1px border and 8px corners. At 768px and above, it has a 2px border and 12px corners. The most recent applicable value persists until another rule overrides it. Reusing the presets on another component shares that progression. Edit the source definition and rebuild to update compiled consumers.</p>
      <h3>Connect edges to the design system</h3>
      <pre><code className="language-css">{`/* Assumes spacing 2/3 and palette primary.main are configured. */
@theme {
  radius-2: xs(space(2)) md(space(3));
  border-1: xs(1px solid palette(primary.main));
}`}</code></pre>
      <p>Spacing supplies reusable measurements; Palette supplies a semantic color role. A 1px hairline can intentionally remain stable. Prefer Density for component spacing, but do not automatically apply Density to border widths or corner radii: choose the intended edge and shape behavior.</p>
      <h3>Radius keywords</h3>
      <div className={styles.tableWrap}><table>
        <thead><tr><th>Expression</th><th>Current compiler result</th></tr></thead>
        <tbody>
          <tr><td><code>radius(2)</code></td><td>The configured radius-2 preset</td></tr>
          <tr><td><code>radius(pill)</code></td><td>9999px</td></tr>
          <tr><td><code>radius(full)</code></td><td>9999px, the same as pill</td></tr>
          <tr><td><code>radius(circle)</code></td><td>50%; a circle requires equal width and height</td></tr>
        </tbody>
      </table></div>
      <p><code>rounded()</code> is an alias of <code>radius()</code>. These keywords are built-in values, not references to editable numbered presets. Rounding a box does not itself clip overflowing child content.</p>
      <h3>A local exception should remain local</h3>
      <pre><code className="language-css">{`.selected-card {
  border: border(1);
  border-color: xs(palette(primary.main)) md(palette(primary.main));
  border-style: xs(dashed) md(dashed);
  border-radius: radius(2);
}`}</code></pre>
      <p>Put explicit longhand overrides after the shorthand and repeat them at thresholds where the preset emits a new border shorthand; that shorthand can reset color and style. This example covers xs and md. Currently, when a numbered Border preset exists, <code>border(1, palette(primary.main), dashed)</code> selects that complete preset and ignores the optional color/style arguments. Use the longhand form above for a deliberate local override.</p>
      <p>Change a shared Border when all its consumers should change their edge. Change a shared Radius when all its consumers should change their corners. For one component, select another suitable existing preset or use explicit CSS. Preserve the reference instead of copying its current computed value.</p>
      <h3>What the interactive demo changes</h3>
      <p>The editor below is a legacy browser preview with its own preset definitions, breakpoint map and CSS generation. Its defaults can differ from the imported theme files. It writes browser style overrides, not source theme files, and is not proof of shared JSON/runtime support. Resize the real browser to inspect its responsive rules. Controls for color and style are local overrides of the selected border preset.</p>
    </section>
    <AgentGuidance id="ai-borders-guide" title="How an AI agent should use Borders">
      <p><strong>Responsibility: maintain shared edge treatments.</strong> Borders combine width, style and color. Components select a preset; Palette can preserve the semantic color dependency.</p>
      <ul>
        <li>Inspect imported <code>@theme</code> definitions, configured breakpoints and referenced Spacing or Palette tokens before choosing a Border.</li>
        <li>Reuse an existing <code>border(n)</code> preset when its complete treatment matches the intent. Do not interpret n as a pixel width.</li>
        <li>Do not replace a preset with its resolved shorthand merely because both look identical now.</li>
        <li>For a local color or style exception, place CSS longhands after the Border declaration. Optional helper arguments do not override an existing preset.</li>
        <li>Modify the shared definition only when all consumers should change. Trace dependent color and spacing tokens before changing foundational values.</li>
        <li>Define new presets before use. Fallback behavior for missing presets is not token validation or a design-system contract.</li>
        <li>Rebuild and check breakpoint boundaries, box sizing, content area, layout shifts, states and edge contrast. Keep accessible focus indicators.</li>
      </ul>
      <p><strong>Decision rule:</strong> Choose a shared Border for a shared edge treatment. Use local longhands for intentional exceptions. Change the theme only for a shared change.</p>
      <h3>Agent reasoning example</h3>
      <p>For “make only the selected card&apos;s border dashed,” retain its preset and add a local dashed style after it at each threshold where its shorthand is re-emitted. Check its responsive widths and confirm unselected cards keep their existing style.</p>
    </AgentGuidance>
    <AgentGuidance id="ai-radii-guide" title="How an AI agent should use Radii">
      <p><strong>Responsibility: maintain shared corner shapes and their responsive behavior.</strong> Preserve intent, not just the current computed value.</p>
      <ul>
        <li>Inspect <code>radius-n</code> theme definitions, breakpoints and any referenced Spacing tokens. Reuse an appropriate configured preset.</li>
        <li>Keep <code>radius(n)</code> when a component belongs to the shared shape system. Do not substitute the value observed at one viewport.</li>
        <li>Use pill/full for the built-in 9999px treatment and circle for 50%. Check dimensions; a rectangular box with 50% rounding is not a circle.</li>
        <li>Change the shared Radius only when all its consumers should follow. Select another preset or use intentional per-corner CSS for a local exception.</li>
        <li>Do not rely on the compiler&apos;s missing-token fallback ramp. Define numbered presets explicitly and verify their dependencies.</li>
        <li>Rebuild and inspect breakpoint boundaries, nested corners, images, overflow, focus outlines and different aspect ratios.</li>
      </ul>
      <p><strong>Decision rule:</strong> Choose a configured Radius for shared corner styling. Define its progression in the theme. Use native CSS for deliberate independent shapes.</p>
      <h3>Agent reasoning example</h3>
      <p>For “make every card using radius-2 rounder on desktop,” inspect all consumers and the configured desktop threshold, update that preset&apos;s progression, rebuild and verify mobile, boundary widths and desktop. Keep components using <code>radius(2)</code>.</p>
    </AgentGuidance>
  </div>
}
