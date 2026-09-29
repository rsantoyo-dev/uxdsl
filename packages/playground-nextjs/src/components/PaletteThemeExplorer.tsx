'use client'


import styles from './PaletteThemeExplorer.module.css'
import { scopedClasses } from '../lib/uxdsl-module-classes'
import { useEffect, useRef, useState } from 'react'
import { InteractiveDemoContainer } from './InteractiveDemoContainer'
import { useTheme } from './ThemeContext'

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
  if (!rgb || rgb.startsWith('#')) return rgb;
  const vals = rgb.match(/\d+/g);
  if (!vals) return '';
  return '#' + vals.slice(0,3).map(x => parseInt(x).toString(16).padStart(2,'0')).join('').toUpperCase();
}

function hexToRgbString(hex: string) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgb(${r}, ${g}, ${b})`
}

function TokenInspectorItem({
    tone,
    variant,
    valueHint,
    isDark,
    onColorChange,
}: {
    tone: string
    variant: string
    valueHint?: string
    isDark: boolean
    onColorChange: (variant: string, nextHex: string) => void
}) {
  const [colorInfo, setColorInfo] = useState({ hex: '', rgb: '' })
    const swatchRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const node = swatchRef.current
        if (!node) return

        const frame = requestAnimationFrame(() => {
            const style = window.getComputedStyle(node)
            const rgb = style.backgroundColor
            setColorInfo({ hex: rgbToHex(rgb), rgb })
        })

        return () => cancelAnimationFrame(frame)
    }, [tone, variant, valueHint, isDark])
  
    const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nextHex = e.target.value.toUpperCase()
        setColorInfo({
            hex: nextHex,
            rgb: hexToRgbString(nextHex),
        })
        onColorChange(variant, nextHex)
  }

    const inputValue = /^#[0-9A-Fa-f]{6}$/.test(colorInfo.hex) ? colorInfo.hex : '#000000'

  return (
      <div className={scopedClasses("inspector-item", styles)}>
                     <div className={scopedClasses("pte-swatch", styles)}>
                         <div
                             ref={swatchRef}
                             className={scopedClasses("pte-swatch__color", styles)}
                             style={{ background: `var(--uxdsl__palette__${tone}-${variant})` }}
                         />
                         <input
                             type="color"
                             value={inputValue}
                             onChange={handleColorInputChange}
                             aria-label={`Change ${tone}-${variant} color`}
                             title={`Edit ${tone}-${variant}`}
                             className={scopedClasses("pte-swatch__input", styles)}
                         />
                     </div>
           <div className={scopedClasses("inspector-item-details", styles)}>
               <span className={scopedClasses("pte-item__variant", styles)}>{variant}</span>
               <div className={scopedClasses("inspector-item-meta", styles)}>
                   <span className={scopedClasses("pte-item__hex", styles)}>{colorInfo.hex}</span>
                   <span className={scopedClasses("pte-item__rgb", styles)}>{colorInfo.rgb}</span>
               </div>
           </div>
      </div>
  )
}

export default function PaletteThemeExplorer({ action }: { action?: React.ReactNode }) {
    const { activeThemeData, setCustomTheme, customThemeName, isDark } = useTheme()
  const [inspectorTone, setInspectorTone] = useState('primary')

    const handleTokenColorChange = (variant: string, nextHex: string) => {
        const palette = { [inspectorTone]: { [variant]: nextHex } }
        const hasDarkAssignment = activeThemeData?.modes?.dark?.palette?.[inspectorTone]?.[variant] !== undefined
        setCustomTheme(customThemeName || 'Custom Theme', isDark && hasDarkAssignment
            ? { modes: { dark: { palette } } }
            : { palette })
    }

  return (
    <InteractiveDemoContainer title="Palette Explorer" action={action}>
             <div className={scopedClasses("pte", styles)}>

                 {/* Detail Panel */}
                 <div className={scopedClasses("pte-detail", styles)}>
                     <div className={scopedClasses("pte-detail__header", styles)}>
                        <h3 className={scopedClasses("pte-detail__title", styles)}>
                            {paletteCards.find(t => t.id === inspectorTone)?.title}
                        </h3>
                        <span className={scopedClasses("pte-detail__subtitle", styles)}>
                            {paletteCards.find(t => t.id === inspectorTone)?.detail}
                        </span>
                     </div>
                     
                     <div className={scopedClasses("inspector-grid", styles)}>
                         {variants.map(variant => (
                                                         <TokenInspectorItem
                                                             key={variant.id}
                                                             tone={inspectorTone}
                                                             variant={variant.id}
                                                             valueHint={(isDark ? activeThemeData?.modes?.dark?.palette?.[inspectorTone]?.[variant.id] : undefined) ?? activeThemeData?.palette?.[inspectorTone]?.[variant.id]}
                                                             isDark={isDark}
                                                             onColorChange={handleTokenColorChange}
                                                         />
                         ))}
                     </div>
                                        <p className={scopedClasses("pte-detail__hint", styles)}>
                                            Click any swatch above to edit and apply the selected color.
                                        </p>
                 </div>

                 {/* Selector Grid */}
                 <h5 className={scopedClasses("pte-selector__heading", styles)}>
                    Select Tone
                 </h5>
                 <div className={scopedClasses("selector-grid", styles)}>
                         {paletteCards.map(tone => (
                             <button key={tone.id} type="button"
                                onClick={() => setInspectorTone(tone.id)}
                                aria-pressed={tone.id === inspectorTone}
                                className={scopedClasses(`pte-selector__option${tone.id === inspectorTone ? ' is-selected' : ''}`, styles)}>
                                 <span className={scopedClasses("pte-selector__name", styles)}>{tone.title}</span>
                                 <span className={scopedClasses("pte-selector__strip", styles)}>
                                     {variants.map(variant => (
                                         <span key={variant.id}
                                              className={scopedClasses("pte-selector__chip", styles)}
                                              style={{ background: `var(--uxdsl__palette__${tone.id}-${variant.id})` }} 
                                         />
                                     ))}
                                 </span>
                             </button>
                         ))}
                     </div>
             </div>
    </InteractiveDemoContainer>
  )
}
