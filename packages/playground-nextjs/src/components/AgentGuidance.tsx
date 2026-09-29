import styles from './AgentGuidance.module.css'
import { scopedClasses } from '../lib/uxdsl-module-classes'

import type { ReactNode } from 'react'

/** Visible, server-rendered documentation. Supply a unique id per page section. */
export default function AgentGuidance({ id, title, children }: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={scopedClasses("agent-guidance", styles)}>
      <p className={scopedClasses("agent-guidance__label", styles)}>AI implementation guide</p>
      <h2 id={`${id}-title`}>{title}</h2>
      {children}
    </section>
  )
}
