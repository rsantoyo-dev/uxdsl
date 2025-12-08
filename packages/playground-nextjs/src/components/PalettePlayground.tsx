'use client'

import { useState } from 'react'



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

import { InteractiveDemoContainer } from './InteractiveDemoContainer'

function rgbToHex(rgb: string) {
  if (!rgb || rgb.startsWith('#')) return rgb;
  const vals = rgb.match(/\d+/g);
  if (!vals) return '';
  return '#' + vals.slice(0,3).map(x => parseInt(x).toString(16).padStart(2,'0')).join('').toUpperCase();
}

function TokenInspectorItem({ tone, variant }: { tone: string, variant: string }) {
  const [colorInfo, setColorInfo] = useState({ hex: '', rgb: '' })
  
  const ref = (node: HTMLDivElement | null) => {
      if (node) {
          setTimeout(() => {
             const style = window.getComputedStyle(node)
             const rgb = style.backgroundColor
             setColorInfo({ hex: rgbToHex(rgb), rgb: rgb })
          }, 0)
      }
  }

  return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--ds__palette__surface-main)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--ds__palette__neutral-light)' }}>
           <div ref={ref} style={{ width: '40px', height: '40px', borderRadius: '4px', background: `var(--ds__palette__${tone}-${variant})`, border: '1px solid rgba(0,0,0,0.1)' }} />
           <div style={{ display: 'flex', flexDirection: 'column' }}>
               <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{variant}</span>
               <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                   <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--ds__palette__text-secondary)' }}>{colorInfo.hex}</span>
                   <span style={{ fontSize: '0.6rem', color: 'var(--ds__palette__text-disabled)' }}>{colorInfo.rgb}</span>
               </div>
           </div>
      </div>
  )
}

export default function PalettePlayground({ action }: { action?: React.ReactNode }) {
  const [bgTone, setBgTone] = useState('primary')
  const [bgVariant, setBgVariant] = useState('main')
  const [textTone, setTextTone] = useState('primary')
  const [textVariant, setTextVariant] = useState('contrast')
  const [inspectorTone, setInspectorTone] = useState('primary')


  const toolbarContent = (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', width: '100%' }}>
         {/* Background Column */}
         <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: '1 1 200px' }}>
           <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ds__palette__text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Background</div>
           <div style={{ display: 'flex', gap: '0.5rem' }}>
             <div className="control-group" style={{ flex: 1 }}>
               <label className="control-label" style={{ fontSize: '0.7rem' }}>Tone</label>
               <select className="control-select" style={{ padding: '4px', fontSize: '0.8rem' }} value={bgTone} onChange={e => setBgTone(e.target.value)}>
                 {paletteCards.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
               </select>
             </div>
             <div className="control-group" style={{ flex: 1 }}>
               <label className="control-label" style={{ fontSize: '0.7rem' }}>Variant</label>
               <select className="control-select" style={{ padding: '4px', fontSize: '0.8rem' }} value={bgVariant} onChange={e => setBgVariant(e.target.value)}>
                 {variants.map(v => <option key={v.id} value={v.id}>{v.id}</option>)}
               </select>
             </div>
           </div>
         </div>

         {/* Text Column */}
         <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: '1 1 200px' }}>
           <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ds__palette__text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Text</div>
           <div style={{ display: 'flex', gap: '0.5rem' }}>
             <div className="control-group" style={{ flex: 1 }}>
               <label className="control-label" style={{ fontSize: '0.7rem' }}>Tone</label>
               <select className="control-select" style={{ padding: '4px', fontSize: '0.8rem' }} value={textTone} onChange={e => setTextTone(e.target.value)}>
                 {paletteCards.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
               </select>
             </div>
             <div className="control-group" style={{ flex: 1 }}>
               <label className="control-label" style={{ fontSize: '0.7rem' }}>Variant</label>
               <select className="control-select" style={{ padding: '4px', fontSize: '0.8rem' }} value={textVariant} onChange={e => setTextVariant(e.target.value)}>
                 {variants.map(v => <option key={v.id} value={v.id}>{v.id}</option>)}
               </select>
             </div>
           </div>
         </div>
       </div>
  )

  return (
    <div id="PalettePlayground" style={{ height: '100%' }}>
      <InteractiveDemoContainer 
        title="Interactive Demo: Palette"
        toolbar={toolbarContent}
        action={action}
      >
        <div className="playground-wrapper">
           <div className="preview-container">
             <div className="live-preview" style={{
               backgroundColor: `var(--ds__palette__${bgTone}-${bgVariant})`,
               color: `var(--ds__palette__${textTone}-${textVariant})`,
               padding: 'var(--space-4)',
               textAlign: 'center',
               fontWeight: 'bold',
               fontSize: '1.2rem',
             }}>
               Live Palette Preview
             </div>
             
             <div style={{
                 marginTop: '1.5rem',
                 padding: '1rem',
                 background: 'var(--ds__palette__surface-light)',
                 border: '1px solid var(--ds__palette__neutral-light)',
                 borderRadius: '6px',
                 textAlign: 'left'
             }}>
                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                   <span style={{ 
                       fontSize: '0.8rem', 
                       color: 'var(--ds__palette__text-secondary)',
                       fontWeight: 600,
                       textTransform: 'uppercase',
                       letterSpacing: '0.05em'
                   }}>
                       CSS Usage
                   </span>
                 </div>
                 <div style={{
                     background: 'var(--ds__palette__surface-dark)',
                     padding: '0.75rem',
                     borderRadius: '6px',
                     fontFamily: 'var(--font-code)',
                     fontSize: '0.85rem',
                     display: 'flex',
                     flexDirection: 'column',
                     gap: '0.25rem',
                     overflowX: 'auto',
                     border: '1px solid var(--ds__palette__neutral-dark)'
                 }}>
                     <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ color: 'var(--ds__palette__secondary-light)' }}>.my-element</span>
                        <span style={{ marginLeft: '0.5rem', color: 'var(--ds__palette__text-disabled)' }}>{`{`}</span>
                     </div>
                     <div style={{ paddingLeft: '1rem' }}>
                        <span style={{ color: 'var(--ds__palette__primary-light)' }}>background</span>
                        <span style={{ color: 'var(--ds__palette__text-disabled)' }}>:</span>
                        <span style={{ marginLeft: '0.5rem', color: 'var(--ds__palette__text-primary)' }}>palette</span>
                        <span style={{ color: 'var(--ds__palette__text-disabled)' }}>(</span>
                        <span style={{ color: 'var(--ds__palette__warning-light)' }}>{bgTone}-{bgVariant}</span>
                        <span style={{ color: 'var(--ds__palette__text-disabled)' }}>)</span>
                        <span style={{ color: 'var(--ds__palette__text-disabled)' }}>;</span>
                     </div>
                     <div style={{ paddingLeft: '1rem' }}>
                        <span style={{ color: 'var(--ds__palette__primary-light)' }}>color</span>
                        <span style={{ color: 'var(--ds__palette__text-disabled)' }}>:</span>
                        <span style={{ marginLeft: '0.5rem', color: 'var(--ds__palette__text-primary)' }}>palette</span>
                        <span style={{ color: 'var(--ds__palette__text-disabled)' }}>(</span>
                        <span style={{ color: 'var(--ds__palette__warning-light)' }}>{textTone}-{textVariant}</span>
                        <span style={{ color: 'var(--ds__palette__text-disabled)' }}>)</span>
                        <span style={{ color: 'var(--ds__palette__text-disabled)' }}>;</span>
                     </div>
                     <div>
                        <span style={{ color: 'var(--ds__palette__text-disabled)' }}>{`}`}</span>
                     </div>
                 </div>
                 <p style={{ 
                     marginTop: '0.75rem', 
                     fontSize: '0.8rem', 
                     color: 'var(--ds__palette__text-secondary)',
                     lineHeight: 1.5
                 }}>
                     <strong style={{ color: 'var(--ds__palette__text-primary)' }}>Token-Aware Colors:</strong> Use <code>palette()</code> to access semantic colors (primary, success, surface) and their variants (main, light, dark).
                 </p>
             </div>
             </div>

             {/* Palette Inspector */}
             <div style={{ marginTop: '2rem', borderTop: '1px solid var(--ds__palette__neutral-light)', paddingTop: '1.5rem' }}>
                 <h4 style={{ fontSize: '0.7rem', color: 'var(--ds__palette__text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                     Palette Explorer
                 </h4>
                 
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
                     
                     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                         {variants.map(variant => (
                             <TokenInspectorItem key={variant.id} tone={inspectorTone} variant={variant.id} />
                         ))}
                     </div>
                 </div>

                 {/* Selector Grid */}
                 <h5 style={{ fontSize: '0.7rem', color: 'var(--ds__palette__text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                    Select Tone
                 </h5>
                 <div style={{ 
                         display: 'grid', 
                         gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', 
                         gap: '0.75rem'
                     }}>
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
           </div>
      </InteractiveDemoContainer>
    </div>
  )
}

