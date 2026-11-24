import Link from 'next/link'
import { LANGUAGE_COMPLETIONS } from 'uxdsl/language'
import { DEFAULT_BREAKPOINTS } from 'uxdsl/theme'
import { PageTitle } from '@/components/PageTitle'
import WriteGet from '@/components/WriteGet'
import { GITHUB_URL } from '@/lib/docs'
import { FUNCTIONS, DIRECTIVES, describe } from '@/lib/language-reference'

export const metadata = { title: 'Language' }

// Which functions, breakpoints and directives exist comes from LANGUAGE_COMPLETIONS
// (uxdsl/language): one the compiler gains without a description here fails the build
// (describe()), and a breakpoint of the base theme appears in the list by itself.
const breakpointNames = new Set(Object.keys(DEFAULT_BREAKPOINTS))
const valueFunctions = describe(LANGUAGE_COMPLETIONS.functions.filter((name) => !breakpointNames.has(name)), FUNCTIONS, 'value functions')
const breakpointFunctions = LANGUAGE_COMPLETIONS.functions.filter((name) => breakpointNames.has(name))
const directives = describe(LANGUAGE_COMPLETIONS.directives, DIRECTIVES, 'directives')
const widthOf = (name: string) => DEFAULT_BREAKPOINTS[name as keyof typeof DEFAULT_BREAKPOINTS]

export default function LanguagePage() {
  return (
    <>
      <PageTitle title="Language" subtitle="A .uxdsl file is SCSS, plus four constructs that read your theme." />
      <div className="doc-section">
        <h2 id="overview">The whole language in one file</h2>
        <p>
          Write SCSS as you already do. UXDSL adds four constructs, and each one takes a value from the theme instead of
          repeating it in the stylesheet:
        </p>
        <div className="doc-section__table-wrap">
          <table>
            <thead><tr><th>Construct</th><th>Looks like</th><th>What you get</th></tr></thead>
            <tbody>
              <tr><td><a href="#functions">Token function</a></td><td><code>space(3)</code></td><td>One value of the theme.</td></tr>
              <tr><td><a href="#responsive">Responsive value</a></td><td><code>xs(column) md(row)</code></td><td>A different value from each breakpoint up.</td></tr>
              <tr><td><a href="#directives">Directive</a></td><td><code>@ds-surface(contained)</code></td><td>A whole role of the theme: several declarations in one line.</td></tr>
              <tr><td><a href="#theme-marker">Theme marker</a></td><td><code>@uxdsl theme;</code></td><td>The theme’s CSS variables, written once per project.</td></tr>
            </tbody>
          </table>
        </div>
        <p>The first three, in a file with a Sass variable and Sass nesting, and the CSS it compiles to:</p>
      </div>

      <WriteGet id="language" />

      <div className="doc-section">
        <h2 id="functions">Token functions</h2>
        <p>
          A token function takes the name of one value in the theme and compiles to its CSS variable:{' '}
          <code>space(3)</code> becomes <code>var(--uxdsl__space__3)</code>. Change the value in the theme and every rule that
          names it follows.
        </p>
        <div className="doc-section__table-wrap">
          <table>
            <thead><tr><th>Function</th><th>Example</th><th>What it is</th></tr></thead>
            <tbody>
              {valueFunctions.map(([name, fn]) => (
                <tr key={name}><td><code>{fn.signature}</code></td><td><code>{fn.example}</code></td><td>{fn.notes}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul>
          <li>The argument is a key of the theme, not a size: <code>space(4)</code> is step 4 of the spacing scale, not 4 pixels.</li>
          <li><code>palette()</code> and <code>color()</code> take an optional opacity from 0 to 1: <code>palette(primary.main, 0.15)</code>.</li>
          <li>A key the theme does not have stops the build, with the closest key as a suggestion.</li>
          <li>The same functions work inside the theme file, so one token can be built from another.</li>
        </ul>
        <p>Three mistakes, and the code each one stops the build with:</p>
        <pre><code className="language-css">{`.panel { gap: space(17); }  /* UXD_SPACE_REFERENCE: the base scale ends at 16 */
.panel { color: palette(primary-main); }  /* UXD_PALETTE_SYNTAX: write palette(primary.main) */
.panel { border: border(1, red); }  /* UXD_EDGE_ARGUMENT: one argument; write border-color after it */`}</code></pre>

        <h2 id="responsive">Responsive values</h2>
        <p>
          Wrap a value in the name of a breakpoint and it applies from that width up. The base theme has{' '}
          {breakpointFunctions.map((name, i) => <span key={name}>{i ? ', ' : ''}<code>{name}()</code> ({widthOf(name)}px)</span>)};
          a breakpoint you add to the theme gets its own function. They compile to <code>min-width</code> media queries.
        </p>
        <pre><code className="language-css">{`.layout {
  flex-direction: xs(column) md(row);
  padding: xs(1rem) xl(2rem) !important;
}
.hero { padding: md(2rem); }`}</code></pre>
        <ul>
          <li>A value stays until a later breakpoint replaces it: <code>md(row)</code> still applies at <code>xl</code>.</li>
          <li>Alone, <code>md(2rem)</code> means “nothing below md, 2rem from md up”. Next to other parts of a value, start at <code>xs()</code>: <code>margin: 0 xs(1rem) md(2rem)</code>.</li>
          <li><code>!important</code> is written once, after the last breakpoint.</li>
          <li>The value inside can be a token function: <code>xs(space(2)) md(space(4))</code>.</li>
          <li>For several declarations from a breakpoint up, write a block instead: <code>@media (--md) {'{'} … {'}'}</code> (see <Link href="/docs/breakpoints">Breakpoints</Link>).</li>
        </ul>
        <p>Four mistakes:</p>
        <pre><code className="language-css">{`.a { padding: xs(1rem) xxl(2rem); }  /* UXD_BREAKPOINT_UNKNOWN: xxl is not a breakpoint of the theme */
.a { margin: 0 md(2rem); }  /* UXD_BREAKPOINT_BASE: write 0 xs(1rem) md(2rem) */
.a { padding: xs(1px !important) md(2px); }  /* UXD_BREAKPOINT_IMPORTANT: write xs(1px) md(2px) !important */
.a { width: calc(100% - xs(1rem) md(2rem)); }  /* UXD_BREAKPOINT_CONTEXT: write xs(calc(100% - 1rem)) md(calc(100% - 2rem)) */`}</code></pre>

        <h2 id="directives">Directives</h2>
        <p>
          A directive gives a rule a role of the theme. One line stands for every declaration the role needs: a container’s
          padding, corners, colors, border and shadow, or a button with all its states.
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
        <p>
          <code>@ds-surface</code>, <code>@ds-button</code> and <code>@ds-input</code> take more after the role, separated by
          spaces: a tone, which is a Palette family and recolors the role, and a size, which picks <code>density(n)</code> for
          the padding and <code>radius(n)</code> for the corners. <code>radius(k)</code> and <code>shadow(k)</code> set only
          that.
        </p>
        <pre><code className="language-css">{`.notice { @ds-surface(outlined info 2); }
.save { @ds-button(contained success); border-radius: radius(pill); }
.hero { @ds-surface(contained radius(4) shadow(3)); }`}</code></pre>
        <ul>
          <li>Write the directive directly inside the rule it styles.</li>
          <li>A declaration after the directive wins over the role’s: <code>.save</code> above is a pill.</li>
          <li>One <code>@ds-button</code> or <code>@ds-input</code> per rule.</li>
          <li>To give a rule one role on a phone and another from a breakpoint up, put the second inside <code>@media (--md)</code>:</li>
        </ul>
        <pre><code className="language-scss">{`.panel {
  @ds-surface(flat);
  @media (--md) { @ds-surface(contained); }
}`}</code></pre>
        <p>Three mistakes:</p>
        <pre><code className="language-css">{`.panel { @ds-surface(glass); }  /* UXD_SURFACE_REFERENCE: the theme has no "glass" role */
.cta { @ds-button(contained); @ds-button(outlined); }  /* UXD_DIRECTIVE_DUPLICATE: one per rule */
@ds-surface(contained);  /* UXD_DIRECTIVE_CONTEXT: it is outside a rule */`}</code></pre>

        <h2 id="theme-marker"><code>@uxdsl theme;</code></h2>
        <p>
          This line is where the theme’s CSS variables are written, the <code>:root {'{'} --uxdsl__… {'}'}</code> block every
          token function points to. It belongs in one place: the top level of your global stylesheet. Every other stylesheet
          leaves it out and only uses the variables.
        </p>
        <ul>
          <li>After <code>uxdsl init</code> it is already there: in <code>src/uxdsl-theme.uxdsl</code>, which the generated entry loads.</li>
          <li>It is the only switch: no option or flag emits the theme.</li>
          <li>The CLI, Vite and webpack warn <code>UXD_THEME_MARKER</code> when no stylesheet writes it, or more than one does.</li>
        </ul>

        <h2 id="scss">Sass</h2>
        <p>
          All of Sass works: variables, maps, mixins, functions, <code>@use</code>, nesting, <code>@each</code>,{' '}
          <code>@if</code>, <code>@extend</code>, the <code>sass:</code> modules. Dart Sass compiles the file first, and UXDSL then resolves its constructs in
          the result. So a token can be a variable’s value, an entry of a map or an argument of a mixin:
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
        <p>A variable can also fill in a directive’s argument, with <code>#{'{'}…{'}'}</code>:</p>
        <pre><code className="language-scss">{`@each $tone in primary, success, error {
  .tag--#{$tone} { @ds-surface(contained #{$tone}); }
}`}</code></pre>
        <p>
          <strong>One thing to remember:</strong> to Sass a token is a piece of text, not a color or a number. A Sass function
          that needs one, such as <code>darken()</code>, fails with <code>UXD_SASS</code>. Do the operation in CSS instead:
          an opacity on the token, <code>color-mix()</code> or <code>calc()</code>.
        </p>
        <pre><code className="language-scss">{`.badge {
  background: palette(primary.main, 0.15);
  border-color: color-mix(in srgb, palette(primary.main) 70%, black);
  padding: calc(space(2) / 2);
  color: darken(palette(primary.main), 10%);  /* UXD_SASS: a token is text to Sass, not a color */
}`}</code></pre>
        <p>
          UXDSL is to SCSS what TypeScript is to JavaScript: every SCSS file is a valid UXDSL file. The few rare exceptions,
          and how files are found and imported, are in the{' '}
          <a href={`${GITHUB_URL}/blob/main/packages/uxdsl/docs/integrations/compile.md#sass-inside-compile`} target="_blank" rel="noopener noreferrer">compile() guide</a>.
        </p>

        <h2 id="postcss-only">Without Sass: the PostCSS plugin alone</h2>
        <p>
          Everything above is what <code>uxdsl build</code>, <code>uxdsl/vite</code> and <code>uxdsl/webpack</code> do. The
          PostCSS plugin used by itself, <code>uxdsl/postcss</code> in a <code>postcss.config.js</code>, runs the four
          constructs on plain CSS and no Sass. Two things change:
        </p>
        <ul>
          <li>Sass syntax fails with <code>UXD_SASS_CONTEXT</code>, and the message names the fix: put it in a <code>.uxdsl</code> file. Native CSS nesting is not Sass: it passes, and reaches the browser as written.</li>
          <li>A directive inside <code>@media</code> under its rule fails with <code>UXD_DIRECTIVE_CONTEXT</code>. Write the rule inside the block, which works everywhere.</li>
        </ul>
        <pre><code className="language-css">{`.card { &:hover { color: palette(primary.main); } }
.card { gap: $gap; }  /* UXD_SASS_CONTEXT: a $variable is Sass */
.card { &__title { color: palette(primary.main); } }  /* UXD_SASS_CONTEXT: an &-suffix selector is Sass */
.panel { @media (--md) { @ds-surface(contained); } }  /* UXD_DIRECTIVE_CONTEXT: with the plugin alone */
@media (--md) { .panel { @ds-surface(contained); } }`}</code></pre>

        <h2 id="errors">When something is wrong</h2>
        <p>
          Nothing falls back silently. A name or a key that does not exist stops the build with a <code>UXD_*</code> code, the
          file, line and column, and what to write instead. <Link href="/docs/diagnostics">Diagnostics</Link> lists every
          code with its meaning and its fix.
        </p>
      </div>
    </>
  )
}
