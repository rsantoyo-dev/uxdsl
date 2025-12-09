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


export default function PalettePlayground({ action }: { action?: React.ReactNode }) {
  const [bgTone, setBgTone] = useState('primary')
  const [bgVariant, setBgVariant] = useState('main')
  const [textTone, setTextTone] = useState('primary')
  const [textVariant, setTextVariant] = useState('contrast')


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
        </div>
      </InteractiveDemoContainer>
    </div>
  )
}

