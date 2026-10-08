import Link from 'next/link'
import schema from 'uxdsl/schema/theme.schema.json'
import base from 'uxdsl/theme/base.json'
import { deepMergeTheme, validateTheme, googleFontsImportUrls } from 'uxdsl/theme'
import { PageTitle } from '@/components/PageTitle'
import ThemeConfigJsonEditor from '@/components/ThemeConfigJsonEditor'
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
        <h2 id="editor">The active theme, as JSON</h2>
        <p>The theme this site is showing. Edit it and the page follows through <code>applyTheme</code>; a change of structure is refused. Nothing is saved to a file.</p>
      </div>
      <ThemeConfigJsonEditor />
    </>
  )
}
