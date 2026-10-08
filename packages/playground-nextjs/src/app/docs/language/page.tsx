import Link from 'next/link'
import { LANGUAGE_COMPLETIONS, DIAGNOSTIC_CATALOG } from 'uxdsl/language'
import { DEFAULT_BREAKPOINTS } from 'uxdsl/theme'
import { PageTitle } from '@/components/PageTitle'
import { FUNCTIONS, DIRECTIVES, describe } from '@/lib/language-reference'

export const metadata = { title: 'Language' }

// The lists on this page come from LANGUAGE_COMPLETIONS and DIAGNOSTIC_CATALOG
// (uxdsl/language): a construct or a code the compiler gains appears here by itself, and a
// function or directive without a description fails the build (describe()).
const breakpointNames = new Set(Object.keys(DEFAULT_BREAKPOINTS))
const valueFunctions = describe(LANGUAGE_COMPLETIONS.functions.filter((name) => !breakpointNames.has(name)), FUNCTIONS, 'value functions')
const breakpointFunctions = LANGUAGE_COMPLETIONS.functions.filter((name) => breakpointNames.has(name))
const directives = describe(LANGUAGE_COMPLETIONS.directives, DIRECTIVES, 'directives')
const languageCodes = Object.entries(DIAGNOSTIC_CATALOG as Record<string, { owner: string; meaning: string }>)
  .filter(([, entry]) => entry.owner === 'compiler' || entry.owner === 'core')

export default function LanguagePage() {
  return (
    <>
      <PageTitle title="Language" subtitle="A .uxdsl file is CSS, plus token functions, breakpoint functions and four directives." />
      <div className="doc-section">
        <h2 id="css">It is CSS</h2>
        <p>
          Anything that is not one of the constructs below passes through unchanged: selectors, properties, <code>calc()</code>,
          <code>@media</code>, <code>@container</code>, <code>@layer</code>, and native nesting (<code>&amp;:hover</code>,
          <code>.a {'{'} .b {'{'} {'}'} {'}'}</code>), which is forwarded to the browser as written, not flattened. Names are
          case-insensitive (<code>Space(1)</code> compiles like <code>space(1)</code>). Every reference is checked against the
          effective theme when it is rewritten; an unknown one stops the build with a <code>UXD_*</code> code and a suggestion.
        </p>

        <h2 id="functions">Token functions</h2>
        <p>Exactly one argument each — a key of the theme — plus an optional alpha on <code>palette()</code> and <code>color()</code>. They work in a declaration and inside a theme value.</p>
        <div className="doc-section__table-wrap">
          <table>
            <thead><tr><th>Function</th><th>Compiles to</th><th>Example</th><th>What it is</th></tr></thead>
            <tbody>
              {valueFunctions.map(([name, fn]) => (
                <tr key={name}><td><code>{fn.signature}</code></td><td><code>{fn.compilesTo}</code></td><td><code>{fn.example}</code></td><td>{fn.notes}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <pre><code className="language-css">{`.panel {
  padding: density(4);
  border: border(1);
  border-radius: radius(2);
  background: palette(surface.main);
  box-shadow: shadow(2);
}
.panel { border: border(1, red); }  /* UXD_EDGE_ARGUMENT: one argument; write the longhands after it */
.panel { color: palette(primary-main); }  /* UXD_PALETTE_SYNTAX: the one spelling is palette(primary.main) */`}</code></pre>

        <h2 id="responsive">Responsive values</h2>
        <p>
          One function per breakpoint of the theme — {breakpointFunctions.map((name, i) => <span key={name}>{i ? ', ' : ''}<code>{name}()</code> (from {DEFAULT_BREAKPOINTS[name as keyof typeof DEFAULT_BREAKPOINTS]}px)</span>)} with
          the base theme — wraps the value that applies from that width up. They compile to <code>min-width</code> media queries
          of the viewport; a theme that adds a breakpoint adds its function.
        </p>
        <pre><code className="language-css">{`.layout {
  flex-direction: xs(column) md(row);
  padding: xs(1rem) xl(2rem) !important;
}
.hero { padding: md(2rem); }`}</code></pre>
        <ul>
          <li>A value applies until a later breakpoint overrides it: <code>md(row)</code> still applies at <code>xl</code>.</li>
          <li>A lone group may start at any breakpoint (<code>md(2rem)</code> is “from md up”). When a value has other parts next to a group, every group needs a base, so the value has the same number of parts at every width.</li>
          <li><code>!important</code> goes after the groups and applies at every breakpoint.</li>
          <li>A responsive value cannot nest in <code>calc()</code>, in another breakpoint, or under <code>@keyframes</code>, <code>@font-face</code> or <code>@page</code>; write the whole value per breakpoint, or put it on a custom property outside.</li>
        </ul>
        <pre><code className="language-css">{`.a { padding: xs(1rem) xxl(2rem); }  /* UXD_BREAKPOINT_UNKNOWN: xxl is not a breakpoint of the theme */
.a { width: calc(100% - xs(1rem) md(2rem)); }  /* UXD_BREAKPOINT_CONTEXT: write xs(calc(100% - 1rem)) md(calc(100% - 2rem)) */
.a { padding: xs(1px !important) md(2px); }  /* UXD_BREAKPOINT_IMPORTANT: write xs(1px) md(2px) !important */
.a { padding: xs(); }  /* UXD_BREAKPOINT_EMPTY */`}</code></pre>

        <h2 id="directives">Directives</h2>
        <p>
          A directive applies a role from the theme to the rule it is written in. It must be a direct child of that rule — at the
          root of a file, or inside <code>@media</code> under the rule, it is <code>UXD_DIRECTIVE_CONTEXT</code> — and it is not itself
          responsive: put a responsive value on a property instead. Arguments are separated by spaces, the role first; a declaration
          written after the directive wins over the role’s.
        </p>
        <div className="doc-section__table-wrap">
          <table>
            <thead><tr><th>Directive</th><th>Example</th><th>What it applies</th></tr></thead>
            <tbody>
              {directives.map(([name, d]) => (
                <tr key={name}><td><code>{d.signature}</code></td><td><code>{d.example}</code></td><td>{d.notes}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <pre><code className="language-css">{`.notice { @ds-surface(outlined info 2); }
.save { @ds-button(contained success); border-radius: radius(pill); }
.cta { @ds-button(contained); @ds-button(outlined); }  /* UXD_DIRECTIVE_DUPLICATE: one control directive per rule */
.panel { @ds-surface(glass); }  /* UXD_SURFACE_REFERENCE: the role is not in the theme */`}</code></pre>

        <h2 id="theme-marker"><code>@uxdsl theme;</code></h2>
        <p>
          For a PostCSS-only setup (one plugin configuration for every stylesheet, as in Next.js without the CLI): written once, at
          the top level of the one global stylesheet, it is where the theme’s <code>:root</code> is emitted. The plugin then runs with
          <code> includeTheme: false</code> everywhere else. A misspelled, repeated or nested marker is <code>UXD_THEME_MARKER</code>.
          See the <Link href="/docs/quick-start">quick start</Link>.
        </p>

        <h2 id="scss">The SCSS-style subset</h2>
        <p>The CLI, the Vite plugin and the Webpack loader read <code>.uxdsl</code> with this subset of Sass, and only this. The standalone PostCSS plugin reads plain CSS with <code>$variables</code> at the root of a file.</p>
        <div className="doc-section__table-wrap">
          <table>
            <thead><tr><th>Supported</th><th>Notes</th></tr></thead>
            <tbody>
              <tr><td><code>$variables</code></td><td>At the root or in a block (block scope), <code>!default</code>, <code>#{'{$x}'}</code> in a selector, value or media query</td></tr>
              <tr><td><code>@if</code> / <code>@else</code></td><td>No <code>@else if</code></td></tr>
              <tr><td><code>@each $x in a, b</code></td><td>Lists only: no maps</td></tr>
              <tr><td><code>@for $i from 1 through 3</code></td><td></td></tr>
              <tr><td><code>@mixin</code> / <code>@include</code> / <code>@content</code></td><td>Positional arguments and defaults; an argument may be a token function or a responsive value. No keyword or variadic arguments</td></tr>
              <tr><td><code>@import &quot;./partial&quot;</code></td><td>A path, with or without the <code>_partial</code> convention</td></tr>
              <tr><td><code>{'//'}</code> comments</td><td>Removed from the output</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Anything else Sass has fails with a located error naming what to write instead: <code>@extend</code>, <code>@use</code>,
          <code>@function</code>, Sass color and math functions and arithmetic outside <code>calc()</code> are <code>UXD_SCSS_UNSUPPORTED</code>;
          <code>&amp;__item</code> (concatenating the parent selector, which native nesting cannot do) is <code>UXD_NESTING_INVALID</code>.
        </p>
        <pre><code className="language-scss">{`$tones: primary, success;
@mixin pad($size) { padding: $size; }
@each $tone in $tones {
  .tag--#{$tone} { @ds-surface(contained #{$tone}); @include pad(density(2)); }
}`}</code></pre>

        <h2 id="errors">Errors the language can raise</h2>
        <p>Read from <code>DIAGNOSTIC_CATALOG</code>; what to do about each one is on <Link href="/docs/diagnostics">Diagnostics</Link>.</p>
        <div className="doc-section__table-wrap">
          <table>
            <thead><tr><th>Code</th><th>Meaning</th></tr></thead>
            <tbody>
              {languageCodes.map(([code, entry]) => <tr key={code}><td><code>{code}</code></td><td>{entry.meaning}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
