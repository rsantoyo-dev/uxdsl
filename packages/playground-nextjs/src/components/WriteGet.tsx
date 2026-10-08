import CodeBlock from './CodeBlock'
import generated from '@/generated/examples.json'

type ExampleId = keyof typeof generated.examples

/**
 * The "theme → UXDSL you write → CSS you get" block of a documentation page.
 *
 * Nothing here is typed by hand: the theme excerpt, the source and the compiled output are
 * src/generated/examples.json, written by scripts/capture-examples.js with uxdsl's own
 * compile() (and re-checked by `npm test`). The output is an excerpt — every rule the
 * source produced, plus the :root declarations of the tokens the example is about.
 */
export default function WriteGet({ id }: { id: ExampleId }) {
  const example = generated.examples[id]
  if (!example) throw new Error(`No compiled example "${id}" in src/generated/examples.json`)
  const theme = JSON.stringify(JSON.parse(example.theme), null, 2)
  return (
    <div className="write-get">
      {theme !== '{}' && (
        <div className="write-get__theme">
          <p className="write-get__label">Theme <span className="write-get__note">uxdsl.theme.json, merged over the base theme</span></p>
          <CodeBlock language="json" code={theme} />
        </div>
      )}
      <div className="write-get__pair">
        <div className="write-get__side">
          <p className="write-get__label">UXDSL you write <span className="write-get__note">{example.sourcePath}</span></p>
          <CodeBlock language="scss" code={example.source} />
        </div>
        <div className="write-get__side">
          <p className="write-get__label">CSS you get <span className="write-get__note">compiled by uxdsl; :root shows only {example.tokens.length === 1 ? 'this token' : 'these tokens'}</span></p>
          <CodeBlock language="css" code={example.output} />
        </div>
      </div>
    </div>
  )
}
