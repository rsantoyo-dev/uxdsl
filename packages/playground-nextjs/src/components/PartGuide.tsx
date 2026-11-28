import type { ReactNode } from 'react'

/**
 * The first thing in every open part of the Live theme handler: what this part of the theme
 * is for, in one sentence, and one thing to try right now, so a first visit knows where to put
 * its hands.
 */
export default function PartGuide({ what, tryThis }: { what: ReactNode; tryThis: ReactNode }) {
  return (
    <div className="pgd">
      <p className="pgd__what">{what}</p>
      <p className="pgd__try">
        <span className="pgd__badge">Try it</span>
        <span>{tryThis}</span>
      </p>
    </div>
  )
}
