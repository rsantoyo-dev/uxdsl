import type { ReactNode } from 'react'
import styles from './AgentGuidance.module.css'

/** Visible, server-rendered documentation. Supply a unique id per page section. */
export default function AgentGuidance({ id, title, children }: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={styles.guide}>
      <p className={styles.label}>AI implementation guide</p>
      <h2 id={`${id}-title`}>{title}</h2>
      {children}
    </section>
  )
}
