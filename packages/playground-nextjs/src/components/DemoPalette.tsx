'use client'


import styles from './DemoPalette.module.css'
import { scopedClasses } from '../lib/uxdsl-module-classes'
import PalettePlayground from './PalettePlayground'
import DemoPaletteConfig from './DemoPaletteConfig'
import PaletteThemeExplorer from './PaletteThemeExplorer'

export default function DemoPalette() {
  return (
    <section id="DemoPalette" className={scopedClasses('module-root', styles) + ' ' + scopedClasses("palette-section demo-section", styles)}>
      <div className={scopedClasses("palette-section__block", styles)}>
        <PalettePlayground />
      </div>

      <div className={scopedClasses("palette-section__block", styles)}>
        <PaletteThemeExplorer />
      </div>

      <DemoPaletteConfig />
    </section>
  )
}
