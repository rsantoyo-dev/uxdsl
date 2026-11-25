'use client'

import { useEffect, useState } from 'react'

export type SuggestionGroup = { label: string; values: string[] }

/**
 * One field of a Surface, Button or Input role: its name and CSS property, where its value
 * comes from, a quick pick among the theme's tokens, and a text field for any value.
 * `onWrite` returns the message to show when the edit is refused, or null.
 */
export default function RoleField({ field, property, value, badge, inherited = false, groups, label, onWrite, action }: {
  field: string
  property?: string
  value: string
  badge?: string
  inherited?: boolean
  groups: SuggestionGroup[]
  label: string
  onWrite?: (value: string) => string | null
  action?: { label: string; onClick: () => void }
}) {
  const [text, setText] = useState(value)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setText(value); setError(null) }, [value])
  const write = (next: string) => {
    const trimmed = next.trim()
    if (!onWrite || trimmed === value) return
    setError(trimmed ? onWrite(trimmed) : 'A field needs a value.')
  }
  const known = groups.some((group) => group.values.includes(value))

  return (
    <div className="rf">
      <div className="rf__head">
        <code className="rf__name">{field}</code>
        {property && property !== field && <span className="rf__property">{property}</span>}
        {badge && <span className={`rf__badge${inherited ? ' is-inherited' : ''}`}>{badge}</span>}
        {action && <button type="button" className="rf__action" onClick={action.onClick}>{action.label}</button>}
      </div>
      {onWrite ? (
        <div className="rf__controls">
          {groups.length > 0 && (
            <select className="rf__select" value={known ? value : ''} onChange={(event) => event.target.value && write(event.target.value)} aria-label={`${label}: pick a value`}>
              {!known && <option value="">as written</option>}
              {groups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.values.map((v) => <option key={v} value={v}>{v}</option>)}
                </optgroup>
              ))}
            </select>
          )}
          <input
            type="text"
            className="rf__text"
            value={text}
            spellCheck={false}
            onChange={(event) => setText(event.target.value)}
            onBlur={() => write(text)}
            onKeyDown={(event) => { if (event.key === 'Enter') write(text) }}
            aria-label={label}
          />
        </div>
      ) : (
        <code className="rf__value">{value}</code>
      )}
      {error && <p className="rf__error" role="alert">{error}</p>}
    </div>
  )
}
