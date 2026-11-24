'use client'

import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import LiveThemeHandler from './LiveThemeHandler'

/**
 * The home page's theme editor, kept quiet: "Name a theme" in the hero is the way to play, and
 * this is the way to fine-tune by hand. Closed, it renders nothing but its summary, so the editor
 * (and the JSON tree it loads) costs nothing until someone opens it.
 */
export default function HomeThemeEditor() {
  const [open, setOpen] = useState(false)
  return (
    <section className="home-live" aria-label="Theme editor">
      <details className="home-live__details" onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary className="home-live__summary">
          <SlidersHorizontal size={16} aria-hidden="true" />
          <span>Fine-tune the theme by hand</span>
          <span className="home-live__hint">colors · palette · breakpoints · spacing · density · typography · borders · radii · JSON</span>
        </summary>
        {open && <LiveThemeHandler showcase={false} />}
      </details>
    </section>
  )
}
