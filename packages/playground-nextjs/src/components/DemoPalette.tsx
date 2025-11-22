'use client'

import { useEffect, useRef, useState } from 'react'

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
  { id: 'main' },
  { id: 'light' },
  { id: 'dark' },
  { id: 'contrast' },
]

function rgbToHex(rgb: string) {
  if (!rgb || rgb === 'rgba(0, 0, 0, 0)') return '';
  const values = rgb.match(/\d+/g);
  if (!values || values.length < 3) return rgb;
  const r = parseInt(values[0]);
  const g = parseInt(values[1]);
  const b = parseInt(values[2]);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

function getContrastColor(rgb: string) {
  if (!rgb || rgb === 'rgba(0, 0, 0, 0)') return 'inherit';
  const values = rgb.match(/\d+/g);
  if (!values || values.length < 3) return 'inherit';
  const r = parseInt(values[0]);
  const g = parseInt(values[1]);
  const b = parseInt(values[2]);
  
  // Calculate relative luminance
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
}

function ColorToken({ tone, variant }: { tone: string, variant: string }) {
  const ref = useRef<HTMLLIElement>(null)
  const [colorValues, setColorValues] = useState({ hex: '', rgb: '', textColor: 'inherit' })

  useEffect(() => {
    if (ref.current) {
      const style = window.getComputedStyle(ref.current)
      const bgColor = style.backgroundColor
      setColorValues({
        hex: rgbToHex(bgColor),
        rgb: bgColor,
        textColor: getContrastColor(bgColor)
      })
    }
  }, [tone, variant])

  return (
    <li
      ref={ref}
      className={`palette-token palette-card-${tone}-${variant}`}
      style={{ color: colorValues.textColor }}
    >
      <span className="token-name">{tone}-{variant}</span>
      <div className="token-values">
        <span className="token-hex">{colorValues.hex}</span>
        <span className="token-rgb">{colorValues.rgb}</span>
      </div>
    </li>
  )
}

export default function DemoPalette() {
  return (
    <section className="palette-section demo-section">
      <div className="palette-header">
        <div>
          <h3 className="demo-title">Palette helpers</h3>
          <p className="demo-subtitle">
            Each card relies purely on <code>palette(tone-variant)</code> helpers.
            Values are computed at runtime from the applied CSS variables.
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
                <ColorToken key={variant.id} tone={tone.id} variant={variant.id} />
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}
