'use client'

import { useEffect, useRef, useState } from 'react'
import { InteractiveDemoContainer } from './InteractiveDemoContainer'
import { useTheme } from './ThemeContext'
import runtime from 'postcss-uxdsl/ds-runtime'

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
    onColorChange,
}: {
    tone: string
    variant: string
    valueHint?: string
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
    }, [tone, variant, valueHint])
  
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
      <div className="inspector-item">
                     <div style={{ position: 'relative', width: '40px', height: '40px' }}>
                         <div
                             ref={swatchRef}
                             style={{
                                 width: '40px',
                                 height: '40px',
                                 borderRadius: '4px',
                                 background: `var(--ds__palette__${tone}-${variant})`,
                                 border: '1px solid rgba(0,0,0,0.1)'
                             }}
                         />
                         <input
                             type="color"
                             value={inputValue}
                             onChange={handleColorInputChange}
                             aria-label={`Change ${tone}-${variant} color`}
                             title={`Edit ${tone}-${variant}`}
                             style={{
                                 position: 'absolute',
                                 inset: 0,
                                 opacity: 0,
                                 cursor: 'pointer'
                             }}
                         />
                     </div>
           <div className="inspector-item-details">
               <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{variant}</span>
               <div className="inspector-item-meta">
                   <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--ds__palette__text-secondary)' }}>{colorInfo.hex}</span>
                   <span style={{ fontSize: '0.6rem', color: 'var(--ds__palette__text-disabled)' }}>{colorInfo.rgb}</span>
               </div>
           </div>
      </div>
  )
}

export default function PaletteThemeExplorer({ action }: { action?: React.ReactNode }) {
    const { activeThemeData, setCustomTheme, customThemeName } = useTheme()
  const [inspectorTone, setInspectorTone] = useState('primary')

    const handleTokenColorChange = (variant: string, nextHex: string) => {
        const token = `${inspectorTone}-${variant}`

        try {
            runtime.updatePalette(token, nextHex, { persist: true })
        } catch {
            document.documentElement.style.setProperty(`--${token}`, nextHex)
            document.documentElement.style.setProperty(`--ds__palette__${token}`, nextHex)
        }

        const nextTheme = JSON.parse(JSON.stringify(activeThemeData || {}))
        if (!nextTheme.palette) nextTheme.palette = {}
        if (!nextTheme.palette[inspectorTone] || typeof nextTheme.palette[inspectorTone] !== 'object') {
            nextTheme.palette[inspectorTone] = {}
        }
        nextTheme.palette[inspectorTone][variant] = nextHex
        setCustomTheme(customThemeName || 'Custom Theme', nextTheme)
    }

  return (
    <InteractiveDemoContainer title="Palette Explorer" action={action}>
             <div style={{ paddingTop: '1.5rem' }}>
                 
                 {/* Detail Panel */}
                 <div style={{ 
                     background: 'var(--ds__palette__surface-light)',
                     border: '1px solid var(--ds__palette__neutral-light)',
                     borderRadius: '8px',
                     padding: '1.5rem',
                     marginBottom: '2rem'
                 }}>
                     <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--ds__palette__text-primary)', margin: 0 }}>
                            {paletteCards.find(t => t.id === inspectorTone)?.title}
                        </h3>
                        <span style={{ fontSize: '0.8rem', color: 'var(--ds__palette__text-secondary)' }}>
                            {paletteCards.find(t => t.id === inspectorTone)?.detail}
                        </span>
                     </div>
                     
                     <div className="inspector-grid">
                         {variants.map(variant => (
                                                         <TokenInspectorItem
                                                             key={variant.id}
                                                             tone={inspectorTone}
                                                             variant={variant.id}
                                                             valueHint={activeThemeData?.palette?.[inspectorTone]?.[variant.id]}
                                                             onColorChange={handleTokenColorChange}
                                                         />
                         ))}
                     </div>
                                        <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--ds__palette__text-secondary)' }}>
                                            Click any swatch above to edit and apply the selected color.
                                        </p>
                 </div>

                 {/* Selector Grid */}
                 <h5 style={{ fontSize: '0.7rem', color: 'var(--ds__palette__text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                    Select Tone
                 </h5>
                 <div className="selector-grid">
                         {paletteCards.map(tone => (
                             <div key={tone.id} 
                                onClick={() => setInspectorTone(tone.id)}
                                style={{ 
                                 display: 'flex', 
                                 alignItems: 'center',
                                 justifyContent: 'space-between',
                                 gap: '1rem',
                                 background: 'var(--ds__palette__surface-light)',
                                 border: tone.id === inspectorTone ? '1px solid var(--ds__palette__primary-main)' : '1px solid var(--ds__palette__neutral-light)',
                                 borderRadius: '6px',
                                 padding: '0.5rem 0.75rem',
                                 cursor: 'pointer',
                                 opacity: tone.id === inspectorTone ? 1 : 0.8,
                                 transition: 'all 0.2s'
                             }}>
                                 <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--ds__palette__text-primary)' }}>{tone.title}</span>
                                 <div style={{ display: 'flex', gap: '2px', width: '100px' }}>
                                     {variants.map(variant => (
                                         <div key={variant.id} 
                                              style={{ 
                                                 flex: 1,
                                                 height: '18px', 
                                                 background: `var(--ds__palette__${tone.id}-${variant.id})`,
                                                 borderRadius: '2px',
                                                 border: '1px solid rgba(0,0,0,0.05)',
                                              }} 
                                         />
                                     ))}
                                 </div>
                             </div>
                         ))}
                     </div>
             </div>
    </InteractiveDemoContainer>
  )
}
