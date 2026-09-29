'use client'


import styles from './DemoPalette.module.css'
import { scopedClasses } from '../lib/uxdsl-module-classes'
import { useEffect, useRef, useState } from 'react'
import { useTheme } from './ThemeContext'
import { InteractiveDemoContainer } from './InteractiveDemoContainer'

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
  { id: 'surface', title: 'Surface', detail: 'Base canvas and sheets' },
] as const
const variants = ['main', 'light', 'dark', 'contrast'] as const

function rgbChannels(value: string): number[] | null {
  const match = value.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i)
  return match ? match.slice(1, 4).map(Number) : null
}

function rgbToHex(value: string): string {
  const channels = rgbChannels(value)
  return channels ? `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}` : ''
}

function readableText(value: string): string {
  const channels = rgbChannels(value)
  if (!channels) return 'inherit'
  const linear = channels.map(channel => {
    const srgb = channel / 255
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  })
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
  return luminance > 0.179 ? '#000000' : '#ffffff'
}

function ColorToken({ tone, variant }: { tone: string; variant: string }) {
  const { activeThemeData, customThemeName, isDark, setCustomTheme } = useTheme()
  const ref = useRef<HTMLLIElement>(null)
  const [color, setColor] = useState({ hex: '', rgb: '', text: 'inherit' })
  const darkSource = activeThemeData?.modes?.dark?.palette?.[tone]?.[variant]
  const source = (isDark ? darkSource : undefined) ?? activeThemeData?.palette?.[tone]?.[variant]
  const linkedColor = typeof source === 'string'
    ? source.match(/^var\(--uxdsl__color__([a-z0-9-]+)\)$/i)?.[1]
    : undefined

  useEffect(() => {
    if (!ref.current) return
    const rgb = getComputedStyle(ref.current).backgroundColor
    setColor({ hex: rgbToHex(rgb), rgb, text: readableText(rgb) })
  }, [tone, variant, source, isDark])

  const changeColor = (event: React.ChangeEvent<HTMLInputElement>) => {
    const hex = event.target.value.toUpperCase()
    const rgb = `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`
    // Edit the mode being previewed. An explicit value replaces its Color reference.
    const palette = { [tone]: { [variant]: hex } }
    setCustomTheme(customThemeName || 'Custom Theme', isDark && darkSource !== undefined
      ? { modes: { dark: { palette } } }
      : { palette })
    setColor({ hex, rgb, text: readableText(rgb) })
  }

  return (
    <li ref={ref} className={scopedClasses(`palette-token palette-card-${tone}-${variant}`, styles)} style={{ color: color.text }}>
      <input type="color" value={color.hex || '#000000'} onChange={changeColor}
        className={scopedClasses("color-picker-overlay", styles)} aria-label={`Change color for ${tone}-${variant}`} />
      <span className={scopedClasses("token-name", styles)}>{tone}-{variant}</span>
      {linkedColor && <span className={scopedClasses("token-match", styles)}>color({linkedColor})</span>}
      <div className={scopedClasses("token-values", styles)}>
        <span className={scopedClasses("token-hex", styles)}>{color.hex}</span>
        <span className={scopedClasses("token-rgb", styles)}>{color.rgb}</span>
      </div>
    </li>
  )
}

export default function DemoPaletteConfig() {
  return (
    <section className={scopedClasses("demo-palette", styles)}>
      <InteractiveDemoContainer title="Global Palette" toolbar={
        <div className={scopedClasses("demo-toolbar-hint", styles)}>Link labels come from explicit references. Editing changes the selected mode&apos;s assignment; an inherited value is shared with light mode.</div>
      }>
        <div className={scopedClasses("palette-stack", styles)}>
          {paletteCards.map(tone => (
            <article key={tone.id} className={scopedClasses("palette-card", styles)}>
              <header className={scopedClasses("palette-card__header", styles)}>
                <h4 className={scopedClasses("palette-card__title", styles)}>{tone.title}</h4>
                <p className={scopedClasses("palette-card__detail", styles)}>{tone.detail}</p>
              </header>
              <ul className={scopedClasses("palette-token-list", styles)}>
                {variants.map(variant => <ColorToken key={variant} tone={tone.id} variant={variant} />)}
              </ul>
            </article>
          ))}
        </div>
      </InteractiveDemoContainer>
    </section>
  )
}
