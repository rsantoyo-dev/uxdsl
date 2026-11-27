import type { ReactNode } from 'react'

/**
 * The head of every tab of the Live theme handler: what this part of the theme is for, in one
 * sentence, and one thing to try right now, so a first visit knows where to put its hands.
 */
export default function TabGuide({ what, tryThis }: { what: ReactNode; tryThis: ReactNode }) {
  return (
    <div className="tgd">
      <p className="tgd__what">{what}</p>
      <p className="tgd__try">
        <span className="tgd__badge">Try it</span>
        <span>{tryThis}</span>
      </p>
    </div>
  )
}
