'use client'

import { useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'

export interface UsageBlock {
  /** What the block is: "In a stylesheet", "In uxdsl.theme.json"… */
  label: string
  code: string
}

/** A JSON excerpt of the theme, as it is written in uxdsl.theme.json. */
export const jsonBlock = (excerpt: unknown, label = 'In uxdsl.theme.json'): UsageBlock => ({
  label,
  code: JSON.stringify(excerpt, null, 2),
})

function CodeBlock({ block }: { block: UsageBlock }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(block.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <figure className="use__block">
      <figcaption className="use__label">
        <span>{block.label}</span>
        <button type="button" className="use__copy" onClick={copy} aria-label={`Copy: ${block.label}`}>
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </figcaption>
      <pre className="use__code"><code>{block.code}</code></pre>
    </figure>
  )
}

/**
 * The end of every tab of the Live theme handler: what is selected above, written the way a
 * project writes it. The stylesheet that uses it, the part of uxdsl.theme.json that defines it,
 * and, where the tab has none above, the same code rendered live. Every block follows the
 * selection and the theme, so it is always what the page is showing.
 */
export default function UsageExample({ blocks, note, children }: { blocks: UsageBlock[]; note?: ReactNode; children?: ReactNode }) {
  return (
    <section className="use" aria-label="Use it in your project">
      <h3 className="use__title">Use it in your project</h3>
      {note && <p className="use__note">{note}</p>}
      {children && <div className="use__live">{children}</div>}
      <div className="use__blocks">
        {blocks.map((block) => <CodeBlock key={block.label} block={block} />)}
      </div>
    </section>
  )
}
