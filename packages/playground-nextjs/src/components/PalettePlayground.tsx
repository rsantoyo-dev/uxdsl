'use client'


import styles from './PalettePlayground.module.css'
import { scopedClasses } from '../lib/uxdsl-module-classes'
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
      <div className={scopedClasses("pp-toolbar", styles)}>
         {/* Background Column */}
         <div className={scopedClasses("pp-toolbar__column", styles)}>
           <div className={scopedClasses("pp-toolbar__heading", styles)}>Background</div>
           <div className={scopedClasses("pp-toolbar__row", styles)}>
             <div className={scopedClasses("control-group pp-toolbar__control", styles)}>
               <label htmlFor="palette-background-tone" className={scopedClasses("control-label pp-toolbar__label", styles)}>Tone</label>
               <select id="palette-background-tone" className={scopedClasses("control-select pp-toolbar__select", styles)} value={bgTone} onChange={e => setBgTone(e.target.value)}>
                 {paletteCards.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
               </select>
             </div>
             <div className={scopedClasses("control-group pp-toolbar__control", styles)}>
               <label htmlFor="palette-background-variant" className={scopedClasses("control-label pp-toolbar__label", styles)}>Variant</label>
               <select id="palette-background-variant" className={scopedClasses("control-select pp-toolbar__select", styles)} value={bgVariant} onChange={e => setBgVariant(e.target.value)}>
                 {variants.map(v => <option key={v.id} value={v.id}>{v.id}</option>)}
               </select>
             </div>
           </div>
         </div>

         {/* Text Column */}
         <div className={scopedClasses("pp-toolbar__column", styles)}>
           <div className={scopedClasses("pp-toolbar__heading", styles)}>Text</div>
           <div className={scopedClasses("pp-toolbar__row", styles)}>
             <div className={scopedClasses("control-group pp-toolbar__control", styles)}>
               <label htmlFor="palette-text-tone" className={scopedClasses("control-label pp-toolbar__label", styles)}>Tone</label>
               <select id="palette-text-tone" className={scopedClasses("control-select pp-toolbar__select", styles)} value={textTone} onChange={e => setTextTone(e.target.value)}>
                 {paletteCards.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
               </select>
             </div>
             <div className={scopedClasses("control-group pp-toolbar__control", styles)}>
               <label htmlFor="palette-text-variant" className={scopedClasses("control-label pp-toolbar__label", styles)}>Variant</label>
               <select id="palette-text-variant" className={scopedClasses("control-select pp-toolbar__select", styles)} value={textVariant} onChange={e => setTextVariant(e.target.value)}>
                 {variants.map(v => <option key={v.id} value={v.id}>{v.id}</option>)}
               </select>
             </div>
           </div>
         </div>
       </div>
  )


  return (
    <div id="PalettePlayground" className={scopedClasses('module-root', styles)}>
      <InteractiveDemoContainer 
        title="Interactive Demo: Palette"
        toolbar={toolbarContent}
        action={action}
      >
        <div className={scopedClasses("playground-wrapper", styles)}>
           <div className={scopedClasses("preview-container", styles)}>
             <div className={scopedClasses("live-preview pp-preview", styles)} style={{
               backgroundColor: `var(--uxdsl__palette__${bgTone}-${bgVariant})`,
               color: `var(--uxdsl__palette__${textTone}-${textVariant})`,
             }}>
               Live Palette Preview
             </div>
             
             <div className={scopedClasses("pp-usage", styles)}>
                 <div className={scopedClasses("pp-usage__header", styles)}>
                   <span className={scopedClasses("pp-usage__title", styles)}>
                       CSS Usage
                   </span>
                 </div>
                 <div className={scopedClasses("pp-code", styles)}>
                     <div className={scopedClasses("pp-code__line", styles)}>
                        <span className={scopedClasses("pp-code__selector", styles)}>.my-element</span>
                        <span className={scopedClasses("pp-code__punct pp-code__gap", styles)}>{`{`}</span>
                     </div>
                     <div className={scopedClasses("pp-code__indent", styles)}>
                        <span className={scopedClasses("pp-code__property", styles)}>background</span>
                        <span className={scopedClasses("pp-code__punct", styles)}>:</span>
                        <span className={scopedClasses("pp-code__function pp-code__gap", styles)}>palette</span>
                        <span className={scopedClasses("pp-code__punct", styles)}>(</span>
                        <span className={scopedClasses("pp-code__argument", styles)}>{bgTone}-{bgVariant}</span>
                        <span className={scopedClasses("pp-code__punct", styles)}>)</span>
                        <span className={scopedClasses("pp-code__punct", styles)}>;</span>
                     </div>
                     <div className={scopedClasses("pp-code__indent", styles)}>
                        <span className={scopedClasses("pp-code__property", styles)}>color</span>
                        <span className={scopedClasses("pp-code__punct", styles)}>:</span>
                        <span className={scopedClasses("pp-code__function pp-code__gap", styles)}>palette</span>
                        <span className={scopedClasses("pp-code__punct", styles)}>(</span>
                        <span className={scopedClasses("pp-code__argument", styles)}>{textTone}-{textVariant}</span>
                        <span className={scopedClasses("pp-code__punct", styles)}>)</span>
                        <span className={scopedClasses("pp-code__punct", styles)}>;</span>
                     </div>
                     <div>
                        <span className={scopedClasses("pp-code__punct", styles)}>{`}`}</span>
                     </div>
                 </div>
                 <p className={scopedClasses("pp-usage__note", styles)}>
                     <strong>Token-Aware Colors:</strong> Use <code>palette()</code> to access semantic colors (primary, success, surface) and their variants (main, light, dark).
                 </p>
             </div>
             </div>
        </div>
      </InteractiveDemoContainer>
    </div>
  )
}
