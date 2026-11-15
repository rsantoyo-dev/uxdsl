import Link from 'next/link'
import { LANGUAGE_COMPLETIONS, DIAGNOSTIC_CATALOG } from 'uxdsl/language'
import { DEFAULT_BREAKPOINTS } from 'uxdsl/theme'
import { PageTitle } from '@/components/PageTitle'
import { GITHUB_URL } from '@/lib/docs'
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
      <PageTitle title="Language" subtitle="A .uxdsl file is SCSS, plus token functions, breakpoint functions and four directives." />
      <div className="doc-section">
        <h2 id="css">It is SCSS</h2>
        <p>
          Through <code>compile()</code>, which the CLI and the bundler adapters run, Dart Sass compiles a <code>.uxdsl</code>{' '}
          file first, and UXDSL then resolves the constructs below in Sass’s output (<a href="#scss">Sass, then UXDSL</a>).
          Anything else is Dart Sass’s output, which UXDSL leaves as it is: nested rules
          come out flattened (<code>.a {'{'} &amp;:hover {'{'} {'}'} {'}'}</code> is <code>.a:hover</code>,{' '}
          <code>.a {'{'} .b {'{'} {'}'} {'}'}</code> is <code>.a .b</code>), a <code>@media</code> nested in a rule moves out
          around the rule, and values are written as Dart Sass writes them (<code>calc(1px + 2px)</code> is <code>3px</code>).
          The PostCSS plugin used alone, <code>uxdsl/postcss</code>, passes what is not one of the constructs through unchanged:
          selectors, properties, <code>calc()</code>, <code>@media</code>, <code>@container</code>, <code>@layer</code>, and
          native nesting, forwarded to the browser as written. Names are
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
          A directive applies a role from the theme to the rule it is written in, as a direct child of that rule; at the root of a
          file it is <code>UXD_DIRECTIVE_CONTEXT</code>. Arguments are separated by spaces, the role first; a declaration written
          after the directive wins over the role’s.
        </p>
        <p>
          Inside <code>@media</code> or <code>@supports</code> under its rule, the two paths differ. Through{' '}
          <code>compile()</code>, Dart Sass moves the at-rule out around the rule, and the directive applies to the rule inside
          it. With <code>uxdsl/postcss</code> alone it is <code>UXD_DIRECTIVE_CONTEXT</code>. Otherwise a directive is not
          itself responsive: put a responsive value on a property instead.
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
        <p>
          Through <code>compile()</code>, this panel takes the contained role from {DEFAULT_BREAKPOINTS.md}px, the base theme’s{' '}
          <code>md</code>, and the flat role below it:
        </p>
        <pre><code className="language-scss">{`.panel {
  @ds-surface(flat);
  @media (min-width: 768px) { @ds-surface(contained); }
}`}</code></pre>
        <p>The same directive with the PostCSS plugin alone, and a directive at the root of a file on either path:</p>
        <pre><code className="language-css">{`.panel { @media (min-width: 768px) { @ds-surface(contained); } }  /* UXD_DIRECTIVE_CONTEXT: with the plugin alone */
@ds-surface(contained);  /* UXD_DIRECTIVE_CONTEXT: at the root of a file */`}</code></pre>

        <h2 id="theme-marker"><code>@uxdsl theme;</code></h2>
        <p>
          The theme’s <code>:root</code> is emitted where this line is written, and nowhere else: written once, at the top level of
          the one global stylesheet, it defines every token there, and every other stylesheet — a component sheet, a CSS Module —
          leaves it out and only consumes them. There is no option for it, on any path: the CLI, the Vite plugin, the Webpack loader
          and the PostCSS plugin alone. The entry <code>uxdsl generate-entry</code> writes loads it from its generated{' '}
          <code>uxdsl-theme.uxdsl</code>. A misspelled, repeated or nested marker is <code>UXD_THEME_MARKER</code>, and so is the
          warning a build prints when no stylesheet, or more than one, emits the theme. See the{' '}
          <Link href="/docs/quick-start">quick start</Link>.
        </p>

        <h2 id="scss">Sass, then UXDSL</h2>
        <p>
          <code>uxdsl build</code>, <code>uxdsl/vite</code> and <code>uxdsl/webpack</code> compile a <code>.uxdsl</code> file
          with <code>compile()</code>. Dart Sass compiles it first, all of SCSS as Dart Sass defines it: <code>@use</code> and{' '}
          <code>@forward</code>, <code>@mixin</code>/<code>@include</code> with keyword and variadic arguments and{' '}
          <code>@content</code>, <code>@function</code>, maps and lists, <code>@if</code>/<code>@else if</code>/<code>@each</code>/
          <code>@for</code>/<code>@while</code>, <code>@extend</code> with <code>%placeholder</code>, the <code>sass:</code>{' '}
          modules, nesting and <code>&amp;</code>. UXDSL then resolves its own words in Sass’s output, so a token can be a
          variable’s or a map’s value, a mixin argument, or what <code>@each</code> and <code>@if</code> pick.{' '}
          <code>@import</code> of a partial still loads it, with Dart Sass’s <code>[import]</code> deprecation as{' '}
          <code>UXD_SASS_WARNING</code>; <code>@use</code> does not warn.
        </p>
        <p>
          UXDSL is to SCSS what TypeScript is to JavaScript: every SCSS file is a valid UXDSL file, except in three cases that
          the <a href={`${GITHUB_URL}/blob/main/packages/uxdsl/docs/integrations/compile.md#sass-inside-compile`} target="_blank" rel="noopener noreferrer">compile() guide</a> documents: a{' '}
          <code>$variable</code> Sass keeps as written fails as <code>UXD_SASS_CONTEXT</code>, text Sass prints that is not CSS
          fails as a parse error, and a project function named with the Sass stage’s internal prefix{' '}
          <code>uxdsl-probe-</code> can change the output.
        </p>
        <pre><code className="language-scss">{`@use 'sass:map';

$tones: (info: palette(info.main), danger: palette(error.main));

@mixin pad($block: space(2), $inline: space(4)) {
  padding: $block $inline;
}

.alert {
  @include pad($inline: density(3));  /* var(--uxdsl__density__3) */
  @each $name, $tone in $tones {
    &--#{$name} { border-color: $tone; }
  }
  &__title { color: map.get($tones, info); }
}`}</code></pre>
        <p>
          To Sass a token is a string, so a Sass function that needs a color or a number fails on one as{' '}
          <code>UXD_SASS</code>. Write the operation in CSS instead: a Palette alpha such as{' '}
          <code>palette(primary.main, 0.5)</code>, <code>color-mix()</code> or <code>calc()</code>.
        </p>
        <pre><code className="language-scss">{`.badge {
  background: palette(primary.main, 0.15);
  border-color: color-mix(in srgb, palette(primary.main) 70%, black);
  padding: calc(space(2) / 2);
  color: darken(palette(primary.main), 10%);  /* UXD_SASS: a token is a string to Sass, not a color */
}`}</code></pre>
        <p>
          The PostCSS plugin used alone, <code>uxdsl/postcss</code>, compiles CSS plus UXDSL and no Sass. A Sass construct
          reaching it fails as <code>UXD_SASS_CONTEXT</code>, naming the fix: name the file <code>.uxdsl</code> and compile it
          with <code>uxdsl build</code>, <code>compile()</code> or an adapter. A few forms the guide lists fail earlier, as
          PostCSS’s own <code>Unknown word</code>. Native nesting passes:
        </p>
        <pre><code className="language-css">{`.card { padding: density(2); }
.card { &:hover { color: palette(primary.main); } }
.card { &__title { color: palette(primary.main); } }  /* UXD_SASS_CONTEXT: an &-suffix selector is Sass */
.card { gap: $gap; }  /* UXD_SASS_CONTEXT: a $variable is Sass */`}</code></pre>
        <p>Through <code>compile()</code>, a Sass variable can also carry a directive’s argument:</p>
        <pre><code className="language-scss">{`$tones: primary, success;
@mixin pad($size) { padding: $size; }
@each $tone in $tones {
  .tag--#{$tone} { @ds-surface(contained #{$tone}); @include pad(density(2)); }
}`}</code></pre>
        <p>
          How files are found and imported, what Dart Sass’s output looks like, functions named like UXDSL’s, and every error
          and warning of the Sass stage are in the{' '}
          <a href={`${GITHUB_URL}/blob/main/packages/uxdsl/docs/integrations/compile.md#sass-inside-compile`} target="_blank" rel="noopener noreferrer">compile() guide</a>.
        </p>

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
