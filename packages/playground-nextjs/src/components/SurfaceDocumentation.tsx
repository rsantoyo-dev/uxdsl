import AgentGuidance from './AgentGuidance'
import styles from './BreakpointDocumentation.module.css'

export function SurfaceDocumentation() {
  return <div className={styles.content}>
    <section aria-labelledby="surfaces-explained">
      <h2 id="surfaces-explained">Give containers a shared visual role.</h2>
      <p><strong>Surfaces compose existing design decisions into a container treatment.</strong> A Surface brings together padding, corner shape, background, foreground, border and shadow. Components choose the role; the theme owns the shared appearance and responsive behavior. A Surface does not define layout, document semantics, interaction logic or z-index.</p>
      <h3>Configure the role in JSON</h3>
      <pre><code className="language-json">{`{
  "breakpoints": { "xs": 0, "md": 768 },
  "surfaces": {
    "contained": {
      "padding": "density(2)",
      "radius": "radius(2)",
      "bg": "palette(surface.main)",
      "color": "palette(surface.contrast)",
      "border": "border(1)",
      "shadow": "xs(shadow(1)) md(shadow(3))"
    }
  }
}`}</code></pre>
      <p>This excerpt assumes referenced Density, Radius, Palette, Border and Shadow tokens exist in the effective theme. The six supported fields are <code>padding</code>, <code>radius</code>, <code>bg</code>, <code>color</code>, <code>border</code> and <code>shadow</code>. Each accepts a nonempty CSS string or a responsive progression with a base value.</p>
      <p>Built-in roles are <code>contained</code>, <code>outlined</code> and <code>flat</code>. Partial overrides inherit missing fields from that role&apos;s defaults. A new custom role inherits the contained defaults for missing fields. A supplied field replaces the entire inherited expression; breakpoint fragments are not merged.</p>
      <div className={styles.comparison}>
        <div><h4>Component intent</h4><pre><code className="language-css">{`.card {
  @ds-surface(contained);
}`}</code></pre></div>
        <div><h4>CSS consumption</h4><pre><code className="language-css">{`.card {
  padding: var(--uxdsl__surface__contained-padding);
  border-radius: var(--uxdsl__surface__contained-radius);
  background: var(--uxdsl__surface__contained-bg);
  color: var(--uxdsl__surface__contained-color);
  border: var(--uxdsl__surface__contained-border);
  box-shadow: var(--uxdsl__surface__contained-shadow);
}`}</code></pre></div>
      </div>
      <p>The generated theme variables retain references such as <code>var(--uxdsl__density__2)</code> and <code>var(--uxdsl__radius__2)</code>. In this example, the shadow changes from shadow-1 to shadow-3 at 768px and remains there until another rule overrides it. Density and Radius can also respond through their own mappings. The component does not need to repeat those decisions.</p>
      <h3>Choose the scope of your change</h3>
      <ul>
        <li><strong>One container:</strong> select another configured Surface or add an intentional CSS override after the directive.</li>
        <li><strong>Every consumer of a Surface:</strong> edit its definition, then rebuild or apply the theme with <code>generateThemeCss(nextTheme)</code>.</li>
        <li><strong>A foundational decision:</strong> change Density, Radius, Palette, Border or Shadow only when all direct and linked consumers should follow.</li>
      </ul>
      <pre><code className="language-css">{`.special-card {
  @ds-surface(contained);
  box-shadow: none; /* Intentional local exception */
}`}</code></pre>
      <p>Preserve the shared role when a component belongs to the system. Copying its current padding, color and shadow into local CSS discards future changes to the role.</p>
      <h3>Optional tone and size</h3>
      <pre><code className="language-css">{`.notice {
  @ds-surface(outlined primary 2);
}`}</code></pre>
      <p>The optional tone names a Palette family. Outlined uses a transparent background with that family&apos;s main color for text and a 1px solid border. Flat uses transparent background and the main foreground while keeping the configured border. Contained and custom roles use the family&apos;s main background and contrast foreground while keeping their configured border.</p>
      <p>The numeric size overrides padding with <code>density(n)</code> and corners with <code>radius(n)</code>. Inspect both definitions before using it; it does not mean n pixels and the two scales need not match. Without these optional arguments, all six fields follow the Surface. A tone intentionally overrides some fields, so later edits to those overridden fields will not affect that toned component.</p>
      <h3>One engine and a supported legacy input</h3>
      <p>PostCSS, runtime theme generation, the inspector and this demo share the Surface engine. Defaults are maintained there and generated into <code>postcss-uxdsl/theme/default-surfaces.uxdsl</code>. A legacy <code>@theme</code> Surface pack remains valid in the same compilation:</p>
      <pre><code className="language-css">{`@theme {
  surface-contained: {
    padding: density(2);
    radius: radius(2);
    bg: palette(surface-main);
    color: palette(surface-contrast);
    border: border(1);
    shadow: shadow(1);
  }
}`}</code></pre>
      <p>JSON fields override matching legacy fields, which override shared defaults. Include legacy definitions in each build that needs them: Surface packs no longer leak through a process-global cache. Unknown roles, fields and referenced Radius/Border/Shadow presets produce errors; verify other token dependencies and actual CSS too. The compiler is not a full CSS or accessibility validator.</p>
      <p>The preview reads the active theme and shared defaults. Its JSON editor applies scoped browser changes without saving your source file. Resize the actual browser to inspect responsive behavior. Invalid edits preserve the last valid preview; Reset restores the active theme. The optional tone and size controls use the same composition function as the compiler. Size options come from the effective Density and Radius definitions, including shared defaults.</p>
    </section>
  </div>
}

export function SurfaceAgentGuidance() {
  return <AgentGuidance id="ai-surfaces-guide" title="How an AI agent should use Surfaces">
    <p><strong>Responsibility: maintain shared container treatments by composing existing design-system roles and tokens.</strong> Preserve intent, not just the current computed value.</p>
    <ul>
      <li>Inspect the effective <code>surfaces</code> configuration, legacy imports, breakpoints and referenced Density, Radii, Palette, Borders and Shadows before selecting a role.</li>
      <li>Reuse a suitable configured role with <code>@ds-surface(role)</code>. Do not rebuild its six properties locally merely because the result looks identical today.</li>
      <li>Preserve token references. Surface radius references Radius, not Spacing; the Surface consumes that system&apos;s shape behavior.</li>
      <li>Use a tone only when an explicit Palette-family override is intended. Check which fields it overrides for the selected variant.</li>
      <li>Use the size argument only after checking both <code>density(n)</code> and <code>radius(n)</code>. Do not infer measurements from the numeric key.</li>
      <li>Change a shared Surface only when all its consumers should follow. Use a different role or subsequent local CSS for an intentional exception.</li>
      <li>Partial overrides inherit missing fields; replacing a field replaces its full responsive expression. Custom roles inherit contained defaults.</li>
      <li>Define roles and dependencies before use. Keep semantic HTML, layout and interaction behavior appropriate to the component.</li>
      <li>Use the shared generator and inspector; update source configuration instead of generated CSS or demo-only default maps.</li>
      <li>Verify breakpoint boundaries, intermediate persistence, nested containers, tone overrides, wrapping, border sizing, clipping, foreground contrast, focus visibility and all shared consumers.</li>
    </ul>
    <p><strong>Decision rule:</strong> Choose the container role in the component. Compose its shared visual decisions in the theme. Use optional arguments or native CSS only for deliberate overrides.</p>
    <h3>Agent reasoning example</h3>
    <p>For “make all contained cards less elevated on desktop,” inspect the contained role and its consumers, modify that role&apos;s shadow progression, apply the theme and verify each relevant breakpoint. Keep components using <code>@ds-surface(contained)</code>. For one exceptional card, retain the role and override its shadow locally.</p>
  </AgentGuidance>
}
