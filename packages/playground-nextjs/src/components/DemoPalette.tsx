'use client'

import PalettePlayground from './PalettePlayground'
import DemoPaletteConfig from './DemoPaletteConfig'
import PaletteThemeExplorer from './PaletteThemeExplorer'

export default function DemoPalette() {
  return (
    <section id="DemoPalette" className="palette-section demo-section">
      <div style={{ marginBottom: '3rem' }}>
        <PalettePlayground />
      </div>

      <div style={{ marginBottom: '3rem' }}>
        <PaletteThemeExplorer />
      </div>

      <DemoPaletteConfig />
    </section>
  )
}
