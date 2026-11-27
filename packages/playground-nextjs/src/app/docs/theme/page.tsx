import Link from 'next/link'
import schema from 'uxdsl/schema/theme.schema.json'
import base from 'uxdsl/theme/base.json'
import { deepMergeTheme, validateTheme, googleFontsImportUrls } from 'uxdsl/theme'
import { PageTitle } from '@/components/PageTitle'
import LiveThemeHandler from '@/components/LiveThemeHandler'
import { ThemeResolution, FontsImport, ValueGrammar } from '@/components/RuntimeEngines'
import { describeFamilies } from '@/lib/theme-reference'

export const metadata = { title: 'Theme' }

type SchemaNode = { type?: string; properties?: Record<string, SchemaNode>; additionalProperties?: SchemaNode | false }

// The families, their closed field sets and the base theme's keys are read from the
// packaged schema and base theme at build time; only what each family is for is written here.
const properties = (schema as { properties: Record<string, SchemaNode> }).properties
const families = describeFamilies(Object.keys(properties).filter((name) => name !== '$schema'))
const baseTheme = base as unknown as Record<string, Record<string, unknown>>

function shapeOf(name: string): string {
  const node = properties[name]
  const entry = node.additionalProperties || undefined
  if (name === 'breakpoints') return 'name → width in px (a number)'
  if (name === 'colors') return 'family → shade → color, or name → color'
  if (name === 'palette') return 'family → variant → value'
  if (name === 'modes') return 'dark → palette → (as palette)'
  if (name === 'fonts') return 'families: name → stack; google: [family spec]'
  if (entry && entry.properties) {
    const fields = Object.keys(entry.properties)
    if (fields.includes('states')) {
      const baseFields = Object.keys(entry.properties.base?.properties || {})
      const states = Object.keys(entry.properties.states?.properties || {})
      return `role → surface, base (${baseFields.join(', ')}), states (${states.join(', ')})`
    }
    return `role → ${fields.join(', ')}`
  }
  return 'key → value'
}

function baseKeys(name: string): string {
  const value = baseTheme[name]
  if (!value || typeof value !== 'object') return '—'
  const keys = Object.keys(value)
  if (name === 'breakpoints') return keys.map((k) => `${k} ${String(value[k])}`).join(', ')
  if (keys.every((k) => /^\d+$/.test(k))) return `${keys[0]}–${keys[keys.length - 1]}`
  return keys.length > 9 ? `${keys.slice(0, 9).join(', ')}, … (${keys.length})` : keys.join(', ')
}

// A real merge and a real validation, run when the page is built.
const override = { palette: { primary: { main: 'color(green.700)' } }, spacing: { 4: '0.875rem' } }
const merged = deepMergeTheme(base, override) as unknown as { palette: { primary: Record<string, string> }; spacing: Record<string, string> }
const invalid = validateTheme({ breakpoints: { md: '768' as unknown as number }, spacing: { 4: 12 as unknown as string } } as never)
const fontImports = googleFontsImportUrls((base as { fonts: { google: string[] } }).fonts.google)

export default function DocsThemePage() {
  return (
    <>
      <PageTitle title="Theme" subtitle="One JSON holds every design decision; the build, the runtime and the audits read the same file." />
      <div className="doc-section">
        <h2 id="families">The families</h2>
        <p>
          A theme is a partial override of the base theme that ships in the package (<code>uxdsl/theme/base.json</code>): write only what
          you change. These are every family the schema knows, with the keys the base theme defines.
        </p>
        <div className="doc-section__table-wrap">
          <table>
            <thead><tr><th>Family</th><th>Shape</th><th>In the base theme</th><th>What it is</th><th>Read by</th></tr></thead>
            <tbody>
              {families.map(([name, family]) => (
                <tr key={name}>
                  <td>{family.page ? <Link href={family.page}><code>{name}</code></Link> : <code>{name}</code>}</td>
                  <td>{shapeOf(name)}</td>
                  <td>{baseKeys(name)}</td>
                  <td>{family.what}</td>
                  <td>{family.consumedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 id="file">Where the theme comes from</h2>
        <p>
          <code>uxdsl.theme.json</code> next to <code>uxdsl.config.cjs</code> (or in the working directory) — or <code>uxdsl.theme.js</code> /
          <code> .cjs</code> exporting the theme object when it is computed. The CLI, the PostCSS plugin, the Vite plugin and the Webpack
          loader discover the same file; a <code>theme</code> option passed to one of them wins. Point <code>$schema</code> at the packaged
          schema and an editor validates and completes it:
        </p>
        <pre><code className="language-json">{`{
  "$schema": "./node_modules/uxdsl/schema/theme.schema.json",
  "breakpoints": { "md": 800 },
  "palette": { "primary": { "main": "color(green.700)" } }
}`}</code></pre>

        <h2 id="merge">How an override merges</h2>
        <p>
          Objects merge key by key; a string — a responsive expression included — replaces the whole value. This override and the
          result <code>deepMergeTheme</code> gave when this page was built:
        </p>
        <pre><code className="language-json">{JSON.stringify(override, null, 2)}</code></pre>
        <pre><code>{`palette.primary → ${JSON.stringify(merged.palette.primary)}\nspacing["4"]   → ${JSON.stringify(merged.spacing['4'])}   spacing["5"] → ${JSON.stringify(merged.spacing['5'])}`}</code></pre>
        <p><code>uxdsl theme</code> prints the effective theme and <code>uxdsl theme --diff</code> labels every leaf <code>project</code> or <code>default</code> (<Link href="/docs/tooling#theme">Tooling</Link>).</p>

        <h2 id="values">Values</h2>
        <p>Every leaf is a nonempty string (a breakpoint width is a number), written in one grammar on every path:</p>
        <ul>
          <li>a literal CSS value: <code>&quot;0.75rem&quot;</code>, <code>&quot;0 1px 2px rgba(0, 0, 0, 0.1)&quot;</code>;</li>
          <li>a token function: <code>space(4)</code>, <code>color(gray.300)</code>, <code>palette(surface.light)</code>, <code>radius(2)</code>, <code>border(1)</code>, <code>shadow(2)</code>;</li>
          <li>a responsive expression over the theme’s breakpoints, <code>xs(space(4)) md(space(5))</code> — not in <code>spacing</code>, <code>colors</code>, <code>palette</code> or <code>fonts.families</code>;</li>
          <li><code>var(--…)</code> as the escape hatch.</li>
        </ul>
        <p>
          <code>validateTheme</code> (<code>uxdsl/theme</code>) is the one validator: the plugin, the CLI, <code>generateThemeCss</code> and
          <code> applyTheme</code> all call it, and nothing is coerced. A number where a string belongs, as this page’s build found:
        </p>
        <pre><code>{invalid.errors.map((error: { path?: string; code?: string; message?: string }) => `${error.code ?? ''} ${error.path ?? ''}: ${error.message ?? ''}`).join('\n')}</code></pre>

        <h2 id="dark-mode">Dark mode</h2>
        <p>
          <code>modes.dark.palette</code> redefines palette values for dark mode, and nothing else has a dark variant. The compiled CSS
          applies them under <code>prefers-color-scheme: dark</code> unless <code>&lt;html data-theme=&quot;light&quot;&gt;</code>, and always under
          <code> data-theme=&quot;dark&quot;</code>. Components keep naming <code>palette(…)</code>; a switch only sets the attribute:
        </p>
        <pre><code className="language-ts">{`document.documentElement.setAttribute('data-theme', 'dark')   // or 'light'; remove it to follow the OS`}</code></pre>
        <p>The compiled ladder is on <Link href="/docs/colors">Colors &amp; palette</Link>; a dark key you omit keeps its light value.</p>

        <h2 id="fonts">Fonts</h2>
        <p>
          <code>fonts.google</code> lists Google Fonts families; the compiled stylesheet and <code>generateThemeCss</code> lead with their
          <code> @import</code>, before every other rule. The base theme’s, encoded by <code>googleFontsImportUrls</code>:
        </p>
        <pre><code>{fontImports.join('\n')}</code></pre>
        <p><code>{'{ "fonts": { "google": [] } }'}</code> opts out: no import, and no request to Google. <code>fonts.families</code> names the stacks (<code>--uxdsl__font__ui</code>, <code>--uxdsl__font__code</code>).</p>
      </div>

      <div className="cap-grid">
        <ThemeResolution />
        <ValueGrammar />
        <FontsImport />
      </div>

      <div className="doc-section">
        <h2 id="editor">Live theme handler</h2>
        <p>
          The whole theme of this site, editable while you look at it, and saved as one JSON file. Everything on these pages is built
          with UXDSL, so every edit reaches all of it at once: the showcase below, the navigation, the documentation.
        </p>
        <ol>
          <li><strong>Change it.</strong> Start with a one-click look (Rounder, Compact, Ocean brand…) or open a tab and change one token or role. Each tab says what it is for and gives you one thing to try.</li>
          <li><strong>Watch the page follow.</strong> Every edit goes through <code>applyTheme</code>, the runtime API your project gets too: values apply live, in light and dark mode, and a change the compiled CSS cannot follow (a new field, a moved breakpoint) is explained, not applied.</li>
          <li><strong>Take it home.</strong> Download <code>uxdsl.theme.json</code>: only what differs from the base theme, the breakpoints you previewed included. Put it next to <code>uxdsl.config.cjs</code> and rebuild. Every tab ends with &quot;Use it in your project&quot;: the stylesheet that uses what you selected, and the part of the file that defines it.</li>
        </ol>
        <p>
          On top, a showcase: a menu, a hero and news cards styled with UXDSL alone. Every edit shows there first, and its
          layout changes at <code>md</code> like any component built with the theme.
        </p>
        <ul>
          <li><strong>Colors / Palette</strong>: first the color collection (<code>colors</code>): pick a shade, change its value, and see every Palette role that follows it, in light and dark mode, including the roles linked to those with <code>palette(…)</code>. Below it, the Palette: choose a role (primary, secondary, surface…), then pick each of its variants from the color collection (<code>color(purple.700)</code>), link it to another role (<code>palette(secondary.main)</code>) or give it a color of its own. The Light/Dark switch edits <code>palette</code> or <code>modes.dark.palette</code>.</li>
          <li><strong>Breakpoints</strong>: slide sm, md, lg and xl and the page switches at the new widths. It is a preview: the theme cannot move a breakpoint at run time, so it moves this page’s compiled media rules and gives you the JSON for your theme file.</li>
          <li><strong>Spacing / Density</strong>: the spacing scale as squares of their size: change a step and see everything that names it, densities first, which move with it. Below, pick a Density token and see what it gives at each breakpoint, as squares around the same content; set its spacing step per breakpoint, or write its definition, and a live example uses it as padding and gap.</li>
          <li><strong>Typography</strong>: pick a text role and see it live at your width, its font size at every breakpoint (a <code>space()</code> step per breakpoint), and every field it emits, its own or the ones it takes from <code>default</code>, to change in place. Choose the fonts of <code>fonts.families</code> from Google Fonts. The whole scale below follows each edit.</li>
          <li><strong>Borders / Radii</strong>: every <code>border(n)</code> and <code>radius(n)</code> token drawn live, and the chosen one on a card, a button and a field. Set it per breakpoint: a Border's width, style and color, a Radius's size. The list of theme values that name it shows who follows.</li>
          <li><strong>Shadows</strong>: every <code>shadow(n)</code> drawn live, and the chosen one on a card, a button and a menu. Edit its layers at any breakpoint: offsets, blur and spread with sliders, the color as a token or any CSS color, inset, a layer added or removed.</li>
          <li><strong>Surfaces</strong>: the six fields of each container role (padding, corners, background, text, border, shadow), every role drawn live in the tone you choose, and the Button and Input roles built on it.</li>
          <li><strong>Buttons / Inputs</strong>: the Surface a control role composes, the base fields it sets over it, and every state (hover, focus, selected, readonly, invalid, disabled), shown at once in the tone you choose. A value applies live; a field or a state the role does not emit yet is refused with the reason, since only a rebuild compiles it.</li>
          <li><strong>JSON</strong>: the whole active theme as a tree: expand a family, edit a value in place, and the editor checks it against the packaged schema as you type. Text and table views are in its menu.</li>
        </ul>
      </div>
      <LiveThemeHandler />
    </>
  )
}
