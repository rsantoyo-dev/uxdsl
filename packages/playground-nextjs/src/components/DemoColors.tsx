"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"

const families = [
  'blue','indigo','purple','pink','red','orange','yellow','green','teal','cyan','gray'
] as const

const shades = ['50','100','200','300','400','500','600','700','800','900'] as const

function rgbToHex(input: string): string {
  // Handles rgb(r,g,b) or rgba(r,g,b,a)
  const m = input.trim().match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\)$/i)
  if (!m) return input
  const r = Math.max(0, Math.min(255, parseInt(m[1]!, 10)))
  const g = Math.max(0, Math.min(255, parseInt(m[2]!, 10)))
  const b = Math.max(0, Math.min(255, parseInt(m[3]!, 10)))
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

function ColorChip({ family, shade }: { family: string; shade: string }) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [hex, setHex] = useState<string>("")

  // Use layout effect to read computed styles after DOM paints
  useLayoutEffect(() => {
    if (!ref.current) return
    const bg = getComputedStyle(ref.current).backgroundColor
    if (bg) setHex(rgbToHex(bg))
  }, [])

  const token = `--ds__color__${family}-${shade}`
  const func = `color(${family}-${shade})`
  return (
    <span ref={ref} className={`color-chip chip--${family}-${shade}`}>
      <span className="chip__line">{func}</span>
      <span className="chip__line">{token}</span>
      <span className="chip__line">{hex}</span>
    </span>
  )
}

export default function DemoColors() {
  return (
    <div className="demo-section">
      <h3 className="demo-title">Color Scale</h3>

      <div className="colors-grid">
        {families.map((fam) => (
          <div key={fam} className="colors-swatch">
            <div className="colors-swatch__title">{fam}</div>
            <div className="colors-swatch__rows">
              {shades.map((s) => (
                <div key={s} className="row">
                  <span className="label">{s}:</span>
                  <ColorChip family={fam} shade={s} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
