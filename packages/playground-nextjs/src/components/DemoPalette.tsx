'use client'

const paletteCards = [
  { id: 'primary', title: 'Primary', detail: 'Brand actions and key highlights' },
  { id: 'secondary', title: 'Secondary', detail: 'Complementary elements and secondary CTAs' },
  { id: 'tertiary', title: 'Tertiary', detail: 'Muted accents and tertiary surfaces' },
  { id: 'success', title: 'Success', detail: 'Positive states and confirmations' },
  { id: 'info', title: 'Info', detail: 'Informational surfaces and banners' },
  { id: 'warning', title: 'Warning', detail: 'Cautionary or pending actions' },
  { id: 'error', title: 'Error', detail: 'Destructive flows and error states' },
  { id: 'dark', title: 'Dark', detail: 'High-contrast backgrounds' },
  { id: 'neutral', title: 'Neutral', detail: 'Structure, frames, and dividers' },
  { id: 'light', title: 'Light', detail: 'Raised backgrounds and cards' },
  { id: 'surface', title: 'Surface', detail: 'Base canvas + sheets' },
]

const variants = [
  { id: 'main', label: 'Main fill' },
  { id: 'light', label: 'Light tint' },
  { id: 'dark', label: 'Dark shade' },
  { id: 'contrast', label: 'Contrast text' },
]

export default function DemoPalette() {
  return (
    <section className="palette-section demo-section">
      <div className="palette-header">
        <div>
          <h3 className="demo-title">Palette helpers</h3>
          <p className="demo-subtitle">
            Each card relies purely on <code>palette(tone-variant)</code> helpers and matching classes, no runtime color
            parsing required.
          </p>
        </div>
      </div>

      <div className="palette-stack">
        {paletteCards.map((tone) => (
          <article key={tone.id} className={`palette-card`}>
            <header className="palette-card__header">
              <h4 className="palette-card__title">{tone.title}</h4>
              <p className="palette-card__detail">{tone.detail}</p>
            </header>

            <ul className="palette-token-list">
              {variants.map((variant) => (
                <li
                  key={variant.id}
                  className={`palette-token palette-card-${tone.id}-${variant.id}`}
                >
                  <span className="token-label">{variant.label}</span>
                  <code className="token-helper">palette({tone.id}-{variant.id})</code>
                  <code className="token-css">--ds__palette__{tone.id}-{variant.id}</code>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}
