'use client'

import PalettePlayground from './PalettePlayground'
import DemoPaletteConfig from './DemoPaletteConfig'
import PaletteThemeExplorer from './PaletteThemeExplorer'

export default function DemoPalette() {
  return (
    <section id="DemoPalette" className="palette-section demo-section">
      <div className="palette-section__block">
        <PalettePlayground />
      </div>

      <div className="palette-section__block">
        <PaletteThemeExplorer />
      </div>

      <DemoPaletteConfig />
    </section>
  )
}
