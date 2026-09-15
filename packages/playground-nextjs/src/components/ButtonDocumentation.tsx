import AgentGuidance from './AgentGuidance'

export function ButtonDocumentation() {
  return <div className="documentation-content"><section className="section">
    <h2 className="section-title">Shared action roles, built on Surfaces</h2>
    <p><strong>Responsibility: define reusable visual action roles and their interaction states.</strong> A Button selects a Surface for its container treatment, then adds shared base overrides and states. Components choose the role; the theme owns its visual decisions. Native HTML and application code own behavior and accessibility.</p>
    <p>Surfaces describe containers. Buttons add stateful action styling. Both read the theme JSON and share the same token and responsive engines. Preserve intent, not just the current computed value.</p>
    <h3>Define the role in JSON</h3>
    <pre><code className="language-json">{JSON.stringify({breakpoints:{xs:0,md:768},buttons:{checkout:{surface:'contained',base:{padding:'density(2)',shadow:'shadow(1)'},states:{hover:{bg:'palette(primary.dark)'},focusvisible:{outline:'2px solid palette(primary.main)','outline-offset':'3px'},selected:{shadow:'xs(shadow(1)) md(shadow(3))'},disabled:{opacity:'0.5',cursor:'not-allowed'}}}}},null,2)}</code></pre>
    <p>This excerpt assumes its referenced tokens exist. Default roles are contained, outlined and flat. A custom role inherits contained defaults unless its configuration overrides them. Its <code>surface</code> selects an existing Surface; <code>base</code> overrides that composition; <code>states</code> overrides matching state fields. Each supplied string replaces its entire responsive expression.</p>
    <pre><code className="language-css">{`.checkout { @ds-button(checkout); }
/* Use a real <button type="button"> for an action. */`}</code></pre>
    <h3>What the component keeps</h3>
    <pre><code className="language-css">{`.checkout {
  padding: var(--uxdsl__button__checkout-base-padding);
  box-shadow: var(--uxdsl__button__checkout-base-shadow);
  /* Other fields reference the selected Surface. */
}
.checkout:focus-visible {
  outline: var(--uxdsl__button__checkout-focusvisible-outline);
  outline-offset: var(--uxdsl__button__checkout-focusvisible-outline-offset);
}`}</code></pre>
    <p>At md, the example selected shadow changes to shadow-3 and persists until overridden. Padding follows Density independently. The component retains references instead of copying the current pixels. Replace managed theme CSS with <code>generateThemeCss(nextTheme)</code> to update existing token values. Adding or removing state fields, changing the selected Surface, or changing role structure requires regenerating component CSS too; <code>buttonComponentCss</code> does this in the demo.</p>
    <h3>Tones, sizes and states</h3>
    <pre><code className="language-css">{`.save { @ds-button(contained primary 2); }
.special { @ds-button(outlined); border-style: dashed; }`}</code></pre>
    <p>An optional configured Palette family overrides Surface colors. Default state colors follow the tone through shared references; explicitly configured Palette references keep their own meaning. A numeric size selects <code>density(n)</code> and <code>radius(n)</code>, not pixels. Explicit Button base overrides take precedence over the Surface composition, including its tone and size. Use local CSS after the directive for a deliberate exception.</p>
    <p>Supported visual fields are padding, radius, bg, color, border, shadow, opacity, outline, outline-offset, transform, cursor and font-weight. Supported states are hover, active, focus, focusvisible, disabled and selected. Selected maps to .is-selected, aria-pressed=true or aria-selected=true; use only semantics appropriate to the actual element. Disabled styling also recognizes aria-disabled, which does not itself prevent activation. Default packs provide hover and selected styling; define other treatments as needed and preserve browser focus indicators.</p>
    <p>Palette contrast tokens are assignments, not automatic contrast guarantees. Verify foreground/background combinations, keyboard focus, disabled behavior and touch use. Styling does not implement click handling or toggle state.</p>
    <h3>Legacy @theme and one shared engine</h3>
    <pre><code className="language-css">{`@theme {
  button-checkout: {
    @ds-surface(contained);
    padding: density(2);
    :hover { bg: palette(primary-dark); }
    :focusvisible { outline: 2px solid palette(primary-main); }
  }
}
.checkout { @ds-button(checkout); }`}</code></pre>
    <p>JSON overrides matching legacy base and state fields, followed by shared defaults. Import legacy definitions in each compilation; Button packs no longer leak through a global cache. PostCSS, runtime generation, inspection and this preview use the same Button engine. Defaults generate the legacy default file. Unknown roles, fields, states and invalid responsive mappings fail clearly; inspect token dependencies and actual CSS because validation is not a complete CSS or accessibility audit.</p>
  </section></div>
}

export function ButtonAgentGuidance() {
  return <AgentGuidance id="ai-buttons-guide" title="How an AI agent should use Buttons">
    <p><strong>Responsibility: preserve shared action roles and their visual states.</strong> Preserve intent, not just the current computed value.</p>
    <ul>
      <li>Inspect buttons, surfaces, Palette, Density, Radii, Borders, Shadows, breakpoints and legacy imports before choosing a role.</li>
      <li>Reuse a configured Button role. Do not replace its directive with currently resolved colors, padding or state styles.</li>
      <li>Choose semantic HTML and implement activation, disabled and toggle behavior independently of styling.</li>
      <li>Inspect inherited base and state fields. Define a custom role in JSON before referencing it. Explicit base fields override the selected Surface composition.</li>
      <li>Use a tone or numeric size only for intentional overrides. Check Palette variants and both Density and Radius keys. Never infer pixels from a token number.</li>
      <li>Change shared definitions only when their consumers should change. Select another role or use subsequent CSS for an isolated exception.</li>
      <li>Keep responsive progressions in the theme and preserve their token dependencies. Include a base value and verify persistence between thresholds.</li>
      <li>Update existing values through managed theme CSS; regenerate component CSS for structural changes to roles or state fields.</li>
      <li>Verify hover, active, selected, disabled, keyboard focus, contrast, wrapping and breakpoint boundaries. Check other consumers of shared dependencies.</li>
    </ul>
    <p><strong>Decision rule:</strong> Choose the configured action role in the component. Maintain shared visual behavior in the theme; keep interaction semantics in HTML and application logic.</p>
    <h3>Agent reasoning example</h3>
    <p>For “increase the selected checkout action depth on desktop,” inspect the checkout role, change its selected shadow progression and verify all checkout consumers around each threshold. Keep their Button references. For one exceptional action, use a suitable existing role or intentional local CSS.</p>
  </AgentGuidance>
}
