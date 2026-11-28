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
 * One live box of the example: an element styled by the very token or role the code names,
 * captioned with the selector that styles it, so code and result read side by side.
 */
export function Result({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <figure className={`use__result${wide ? ' use__result--wide' : ''}`}>
      <div className="use__result-box">{children}</div>
      <figcaption className="use__result-label">{label}</figcaption>
    </figure>
  )
}

/**
 * The end of every part of the Live theme handler: what is selected above, written the way a
 * project writes it. The stylesheet that uses it, the part of uxdsl.theme.json that defines it,
 * and, where the part has none above, the same code rendered live. Every block follows the
 * selection and the theme, so it is always what the page is showing. `subject` names the
 * example where a part holds two of them (Colors and Palette, Spacing and Density). `title`
 * replaces the heading where the block stands on its own (the page's take-home example).
 */
export default function UsageExample({ blocks, note, subject, title = 'Use it in your project', children }: { blocks: UsageBlock[]; note?: ReactNode; subject?: string; title?: string; children?: ReactNode }) {
  return (
    <section className="use" aria-label={subject ? `${title}: ${subject}` : title}>
      <h3 className="use__title">{title}</h3>
      {note && <p className="use__note">{note}</p>}
      {children ? (
        <>
          {/* The code and what it gives, side by side; the theme excerpt below. */}
          <div className="use__pair">
            <CodeBlock block={blocks[0]} />
            <div className="use__live">
              <span className="use__live-title">What it gives, live with this page&apos;s theme</span>
              <div className="use__results">{children}</div>
            </div>
          </div>
          <div className="use__blocks">
            {blocks.slice(1).map((block) => <CodeBlock key={block.label} block={block} />)}
          </div>
        </>
      ) : (
        <div className="use__blocks">
          {blocks.map((block) => <CodeBlock key={block.label} block={block} />)}
        </div>
      )}
    </section>
  )
}
