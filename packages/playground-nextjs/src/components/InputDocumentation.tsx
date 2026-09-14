import AgentGuidance from './AgentGuidance'

export function InputDocumentation() {
  return <div className="documentation-content"><section className="section">
    <h2 className="section-title">Shared field roles and visual states</h2>
    <p><strong>Responsibility: maintain reusable field treatments and their responsive and interaction styles.</strong> A component chooses an Input role. The theme composes its Surface, overrides, caret, placeholder and state styles. HTML and application logic provide labels, editing behavior, validation and error messages.</p>
    <p>Inputs build on Surfaces, Density, Radii, Palette, Borders and Shadows. Preserve intent, not just the current computed value: a field should remain connected to its configured role when its current color or padding happens to match a literal value.</p>
    <h3>Define a field role in the theme JSON</h3>
    <pre><code className="language-json">{JSON.stringify({breakpoints:{xs:0,md:768},inputs:{search:{surface:'outlined',base:{padding:'density(2)',caret:'palette(primary.main)',placeholder:'palette(neutral.dark)'},states:{focus:{border:'1px solid palette(primary.main)'},focusvisible:{outline:'2px solid palette(primary.main)','outline-offset':'2px'},invalid:{border:'2px solid palette(error.main)'},disabled:{opacity:'0.6'}}}}},null,2)}</code></pre>
    <p>This excerpt assumes those dependencies exist. Default roles are contained, outlined and underline. Custom roles inherit contained defaults; choose a configured Surface explicitly when needed. Partial base and state fields merge with defaults. A supplied value replaces the entire field, including its responsive progression.</p>
    <pre><code className="language-css">{`.search-field { @ds-input(search); }`}</code></pre>
    <pre><code className="language-html">{`<label for="search">Search</label>
<input id="search" class="search-field" type="search"
       aria-describedby="search-help">
<p id="search-help">Enter a product name.</p>`}</code></pre>
    <h3>The component preserves shared references</h3>
    <pre><code className="language-css">{`.search-field {
  padding: var(--input-search-base-padding);
  caret-color: var(--input-search-base-caret);
  /* Remaining container fields reference the selected Surface. */
}
.search-field::placeholder {
  color: var(--input-search-base-placeholder);
}
.search-field:focus {
  border: var(--input-search-focus-border);
}`}</code></pre>
    <p>Padding follows Density. Other fields can define their own progression, such as <code>xs(shadow(1)) md(shadow(2))</code>. Define a base value; the most recent applicable rule persists until another threshold overrides it. Update the JSON and rebuild, or replace managed theme CSS to update existing values. Adding or removing fields or changing a role&apos;s Surface requires regenerating component CSS too; the demo uses <code>inputComponentCss</code> for that step.</p>
    <h3>Tones, sizes and underline treatment</h3>
    <pre><code className="language-css">{`.email { @ds-input(outlined primary 2); }
.compact-search { @ds-input(underline); width: auto; }`}</code></pre>
    <p>An optional Palette family overrides the Surface colors. Default caret and focus treatments follow that tone when the effective theme supplies the Palette family; explicit Palette assignments retain their meaning. Invalid defaults keep the error role. Pass the same effective theme to build and runtime. A numeric size selects Density and Radius keys, not pixels. Explicit Input base fields override the Surface composition, including tone and size.</p>
    <p>The underline role uses the flat Surface and explicitly removes full borders and shadows, then applies <code>underline</code> as <code>border-bottom</code>. In custom roles, <code>underline</code> changes only the bottom border; add <code>border: none</code> in the base when bottom-only treatment is intended.</p>
    <p>Supported fields: padding, radius, bg, color, border, shadow, caret, placeholder, underline, opacity, outline, outline-offset, transform, cursor and font-weight. Placeholder becomes a separate <code>::placeholder</code> rule, including inside states. Supported states: hover, focus, focusvisible, readonly, invalid and disabled.</p>
    <h3>Styling and form behavior have distinct responsibilities</h3>
    <ul>
      <li>Use visible labels and appropriate native input types. Placeholder text does not replace a label. Associate help and error messages using aria-describedby.</li>
      <li>Invalid styling matches native :invalid or aria-invalid=true. Native :invalid may match before interaction; the application controls when to show custom validation errors.</li>
      <li>Disabled styling matches :disabled or aria-disabled=true. The disabled attribute prevents editing; aria-disabled alone does not. Readonly styling uses :read-only; use the native readOnly attribute on supported controls.</li>
      <li>The engine keeps native focus outlines, inherits typography, sets border-box sizing and defaults width to 100%. It does not remove native appearance. Use subsequent CSS for deliberate local layout changes.</li>
      <li>This treatment targets text-like inputs and textareas. Selects need their native interaction checked; checkbox, radio, range and file controls need dedicated treatment. Do not apply this pack indiscriminately.</li>
      <li>Verify keyboard focus, foreground and placeholder contrast, error communication and touch use. Palette names do not guarantee accessibility.</li>
    </ul>
    <h3>Legacy @theme remains supported</h3>
    <pre><code className="language-css">{`@theme {
  input-search: {
    @ds-surface(outlined);
    padding: density(2);
    placeholder: palette(neutral-dark);
    :focus { border: 1px solid palette(primary-main); }
    :invalid { border: 2px solid palette(error-main); }
  }
}
.search-field { @ds-input(search); }`}</code></pre>
    <p>JSON overrides matching legacy base and state fields, then defaults. Import legacy packs in each compilation; Input packs no longer leak through a global cache. PostCSS, runtime, inspection and this demo share the Input engine. Default files are generated from that engine. Undefined roles, unsupported fields and invalid responsive mappings fail clearly; inspect remaining dependencies and actual CSS too.</p>
    <p>The demo applies scoped JSON changes without saving the source file. Invalid edits retain the last valid preview. Resize the actual viewport, use the keyboard and try native readonly and disabled controls.</p>
  </section></div>
}

export function InputAgentGuidance() {
  return <AgentGuidance id="ai-inputs-guide" title="How an AI agent should use Inputs">
    <p><strong>Responsibility: preserve shared field roles and visual states while keeping form semantics in HTML and application logic.</strong> Preserve intent, not just the current computed value.</p>
    <ul>
      <li>Inspect inputs, surfaces, referenced Density, Radius, Palette, Borders, Shadows, breakpoints and legacy imports before choosing or modifying a role.</li>
      <li>Reuse a suitable configured role with @ds-input(role). Do not copy its current resolved colors, padding or focus treatment into local CSS.</li>
      <li>Inspect inherited fields. Custom roles inherit contained defaults; explicit base fields override the selected Surface composition. Define a role and its dependencies before using it.</li>
      <li>Use optional tones and sizes deliberately. Check the Palette family and both Density and Radius keys. Keep error styling connected to its error meaning.</li>
      <li>Use labels, appropriate input types, native disabled/readOnly behavior and associated error messages. aria-invalid communicates an error; it does not validate the value.</li>
      <li>Keep placeholder styling separate from labels. Preserve visible keyboard focus and check actual contrast and native interaction.</li>
      <li>Modify shared role definitions only when all consumers should follow. Select another role or use subsequent local CSS for an isolated exception.</li>
      <li>Generate successfully before replacing managed theme CSS. Regenerate component CSS when adding/removing fields or changing Surface selection. Preview edits do not save JSON.</li>
      <li>Verify below, at and above configured breakpoints, intermediate persistence, focus, hover, invalid, disabled, readonly, placeholder states and every affected consumer.</li>
    </ul>
    <p><strong>Decision rule:</strong> Choose the configured field role in the component. Maintain shared visual behavior in the theme; implement validation and interaction semantics separately.</p>
    <h3>Agent reasoning example</h3>
    <p>For “make all search fields use a stronger error border,” inspect the search role and its consumers, change its invalid border in the theme, regenerate the needed CSS and verify native and aria-invalid states. Keep components using @ds-input(search). For one exceptional field, choose another role or deliberate local CSS.</p>
  </AgentGuidance>
}
