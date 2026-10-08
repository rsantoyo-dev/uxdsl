'use client'

import { useState } from 'react'

// The three default Surface roles crossed with six Palette tones: eighteen classes, written as
// one loop in SurfaceGrid.uxdsl and compiled by `uxdsl build` with the rest of the site.
const ROLES = ['contained', 'outlined', 'flat'] as const
const TONES = ['primary', 'secondary', 'success', 'info', 'warning', 'error'] as const
const MAX = 48

const source = `$roles: contained, outlined, flat;
$tones: primary, secondary, success, info, warning, error;

.surface-grid {
  display: grid;
  grid-template-columns: xs(repeat(2, 1fr)) md(repeat(3, 1fr)) xl(repeat(6, 1fr));
  gap: density(3);
}

@each $role in $roles {
  @each $tone in $tones {
    .surface-grid__tile--#{$role}-#{$tone} {
      @ds-surface(#{$role} #{$tone});
    }
  }
}`

export default function SurfaceGrid() {
  const [count, setCount] = useState(18)

  return (
    <section className="surface-grid-demo" aria-labelledby="surface-grid-title">
      <h2 id="surface-grid-title">Many components, one role</h2>
      <p>
        Eighteen classes from one loop: every tile below is <code>@ds-surface(role tone)</code>, so its padding,
        corners, border, shadow and colors come from the theme. Change the <code>contained</code> role in the
        theme and every contained tile follows; switch the site theme in the header and all of them do.
      </p>
      <pre><code className="language-scss">{source}</code></pre>
      <label className="surface-grid-demo__control">
        <span>Tiles: <strong>{count}</strong> (up to {MAX})</span>
        <input type="range" min={6} max={MAX} step={6} value={count} onChange={(event) => setCount(Number(event.target.value))} />
      </label>
      <div className="surface-grid">
        {Array.from({ length: count }, (_, i) => {
          const role = ROLES[Math.floor(i / TONES.length) % ROLES.length]
          const tone = TONES[i % TONES.length]
          return (
            <div key={i} className={`surface-grid__tile--${role}-${tone}`}>
              <p className="surface-grid__title">{tone}</p>
              <p className="surface-grid__meta">{role}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
