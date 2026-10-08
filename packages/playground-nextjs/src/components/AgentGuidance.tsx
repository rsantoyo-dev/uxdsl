import type { ReactNode } from 'react'

/** One primitive's guide on /docs/for-ai-agents: server-rendered, collapsed until opened,
 *  so the page stays scannable and the text stays searchable. Supply a unique id. */
export default function AgentGuidance({ id, title, children }: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <details id={id} className="agent-guidance">
      <summary className="agent-guidance__summary">
        <span className="agent-guidance__title">{title}</span>
      </summary>
      <div className="agent-guidance__body">{children}</div>
    </details>
  )
}
