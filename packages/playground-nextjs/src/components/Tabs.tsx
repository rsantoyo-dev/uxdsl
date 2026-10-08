'use client'

import { Children, useId, useState, type ReactNode } from 'react'

/**
 * Accessible tabs. Every panel is rendered (server-side too) and the inactive ones are
 * `hidden`, so the text of each tab is in the page and its code examples are compiled by
 * the documentation-examples check like any other.
 */
export default function Tabs({ labels, children }: { labels: string[]; children: ReactNode }) {
  const [active, setActive] = useState(0)
  const id = useId()
  const panels = Children.toArray(children)
  const focus = (index: number) => {
    const next = (index + labels.length) % labels.length
    setActive(next)
    document.getElementById(`${id}-tab-${next}`)?.focus()
  }
  return (
    <div className="tabs">
      <div className="tabs__list" role="tablist">
        {labels.map((label, index) => (
          <button
            key={label}
            id={`${id}-tab-${index}`}
            type="button"
            role="tab"
            aria-selected={index === active}
            aria-controls={`${id}-panel-${index}`}
            tabIndex={index === active ? 0 : -1}
            className="tabs__tab"
            onClick={() => setActive(index)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') focus(index + 1)
              if (event.key === 'ArrowLeft') focus(index - 1)
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {panels.map((panel, index) => (
        <div key={index} id={`${id}-panel-${index}`} role="tabpanel" aria-labelledby={`${id}-tab-${index}`} hidden={index !== active} className="tabs__panel">
          {panel}
        </div>
      ))}
    </div>
  )
}

export function Tab({ children }: { children: ReactNode }) {
  return <>{children}</>
}
