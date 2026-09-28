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
      <div className="pp-toolbar">
         {/* Background Column */}
         <div className="pp-toolbar__column">
           <div className="pp-toolbar__heading">Background</div>
           <div className="pp-toolbar__row">
             <div className="control-group pp-toolbar__control">
               <label className="control-label pp-toolbar__label">Tone</label>
               <select className="control-select pp-toolbar__select" value={bgTone}onChange={e => setBgTone(e.target.value)}>
                 {paletteCards.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
               </select>
             </div>
             <div className="control-group pp-toolbar__control">
               <label className="control-label pp-toolbar__label">Variant</label>
               <select className="control-select pp-toolbar__select" value={bgVariant}onChange={e => setBgVariant(e.target.value)}>
                 {variants.map(v => <option key={v.id} value={v.id}>{v.id}</option>)}
               </select>
             </div>
           </div>
         </div>

         {/* Text Column */}
         <div className="pp-toolbar__column">
           <div className="pp-toolbar__heading">Text</div>
           <div className="pp-toolbar__row">
             <div className="control-group pp-toolbar__control">
               <label className="control-label pp-toolbar__label">Tone</label>
               <select className="control-select pp-toolbar__select" value={textTone}onChange={e => setTextTone(e.target.value)}>
                 {paletteCards.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
               </select>
             </div>
             <div className="control-group pp-toolbar__control">
               <label className="control-label pp-toolbar__label">Variant</label>
               <select className="control-select pp-toolbar__select" value={textVariant}onChange={e => setTextVariant(e.target.value)}>
                 {variants.map(v => <option key={v.id} value={v.id}>{v.id}</option>)}
               </select>
             </div>
           </div>
         </div>
       </div>
  )


  return (
    <div id="PalettePlayground">
      <InteractiveDemoContainer 
        title="Interactive Demo: Palette"
        toolbar={toolbarContent}
        action={action}
      >
        <div className="playground-wrapper">
           <div className="preview-container">
             <div className="live-preview pp-preview" style={{
               backgroundColor: `var(--uxdsl__palette__${bgTone}-${bgVariant})`,
               color: `var(--uxdsl__palette__${textTone}-${textVariant})`,
             }}>
               Live Palette Preview
             </div>
             
             <div className="pp-usage">
                 <div className="pp-usage__header">
                   <span className="pp-usage__title">
                       CSS Usage
                   </span>
                 </div>
                 <div className="pp-code">
                     <div className="pp-code__line">
                        <span className="pp-code__selector">.my-element</span>
                        <span className="pp-code__punct pp-code__gap">{`{`}</span>
                     </div>
                     <div className="pp-code__indent">
                        <span className="pp-code__property">background</span>
                        <span className="pp-code__punct">:</span>
                        <span className="pp-code__function pp-code__gap">palette</span>
                        <span className="pp-code__punct">(</span>
                        <span className="pp-code__argument">{bgTone}-{bgVariant}</span>
                        <span className="pp-code__punct">)</span>
                        <span className="pp-code__punct">;</span>
                     </div>
                     <div className="pp-code__indent">
                        <span className="pp-code__property">color</span>
                        <span className="pp-code__punct">:</span>
                        <span className="pp-code__function pp-code__gap">palette</span>
                        <span className="pp-code__punct">(</span>
                        <span className="pp-code__argument">{textTone}-{textVariant}</span>
                        <span className="pp-code__punct">)</span>
                        <span className="pp-code__punct">;</span>
                     </div>
                     <div>
                        <span className="pp-code__punct">{`}`}</span>
                     </div>
                 </div>
                 <p className="pp-usage__note">
                     <strong>Token-Aware Colors:</strong> Use <code>palette()</code> to access semantic colors (primary, success, surface) and their variants (main, light, dark).
                 </p>
             </div>
             </div>
        </div>
      </InteractiveDemoContainer>
    </div>
  )
}

