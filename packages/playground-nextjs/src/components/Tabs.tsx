'use client'

import { Children, useEffect, useId, useState, type ReactNode } from 'react'

/**
 * Accessible tabs. Every panel is rendered (server-side too) and the inactive ones are
 * `hidden`, so the text of each tab is in the page and its code examples are compiled by
 * the documentation-examples check like any other.
 *
 * With `ids`, each tab is an address: its button carries the id, so `#<id>` scrolls to the
 * tab row and opens that tab, on arrival and whenever the hash changes, and choosing a tab
 * writes its id to the address without adding a history entry.
 */
export default function Tabs({ labels, ids, children }: { labels: readonly string[]; ids?: readonly string[]; children: ReactNode }) {
  const [active, setActive] = useState(0)
  const id = useId()
  const panels = Children.toArray(children)
  const tabId = (index: number) => ids?.[index] ?? `${id}-tab-${index}`

  useEffect(() => {
    if (!ids) return undefined
    const follow = () => {
      const index = ids.indexOf(window.location.hash.slice(1))
      if (index >= 0) setActive(index)
    }
    follow()
    window.addEventListener('hashchange', follow)
    return () => window.removeEventListener('hashchange', follow)
  }, [ids])

  const select = (index: number) => {
    setActive(index)
    // replaceState, with the router's own state: the address names the tab and Back still leaves the page.
    if (ids) window.history.replaceState(window.history.state, '', `#${ids[index]}`)
  }
  const focus = (index: number) => {
    const next = (index + labels.length) % labels.length
    select(next)
    document.getElementById(tabId(next))?.focus()
  }
  return (
    <div className="tabs">
      <div className="tabs__list" role="tablist">
        {labels.map((label, index) => (
          <button
            key={label}
            id={tabId(index)}
            type="button"
            role="tab"
            aria-selected={index === active}
            aria-controls={`${id}-panel-${index}`}
            tabIndex={index === active ? 0 : -1}
            className="tabs__tab"
            onClick={() => select(index)}
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
        <div key={index} id={`${id}-panel-${index}`} role="tabpanel" aria-labelledby={tabId(index)} hidden={index !== active} className="tabs__panel">
          {panel}
        </div>
      ))}
    </div>
  )
}

export function Tab({ children }: { children: ReactNode }) {
  return <>{children}</>
}
