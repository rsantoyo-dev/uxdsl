"use client"

import { useEffect, useRef, useState } from "react"

const families = [
  'blue','indigo','purple','pink','red','orange','yellow','green','teal','cyan','gray'
] as const

const shades = ['50','100','200','300','400','500','600','700','800','900'] as const

function rgbToHex(rgb: string) {
  if (!rgb || rgb === 'rgba(0, 0, 0, 0)') return '';
  const values = rgb.match(/\d+/g);
  if (!values || values.length < 3) return rgb;
  const r = parseInt(values[0]);
  const g = parseInt(values[1]);
  const b = parseInt(values[2]);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

function getContrastColor(rgb: string) {
  if (!rgb || rgb === 'rgba(0, 0, 0, 0)') return 'inherit';
  const values = rgb.match(/\d+/g);
  if (!values || values.length < 3) return 'inherit';
  const r = parseInt(values[0]);
  const g = parseInt(values[1]);
  const b = parseInt(values[2]);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
}

function hexToRgbString(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

function ColorScaleToken({ family, shade }: { family: string; shade: string }) {
  const ref = useRef<HTMLLIElement>(null)
  const [colorValues, setColorValues] = useState({ hex: '', rgb: '', textColor: 'inherit' })

  useEffect(() => {
    if (ref.current) {
      const style = window.getComputedStyle(ref.current)
      const bgColor = style.backgroundColor
      setColorValues({
        hex: rgbToHex(bgColor),
        rgb: bgColor,
        textColor: getContrastColor(bgColor)
      })
    }
  }, [family, shade])

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHex = e.target.value;
    const newRgb = hexToRgbString(newHex);
    const varName = `color__${family}-${shade}`; // Note: UXDSL uses --ds__color__...
    
    // Update CSS variables globally
    // We need to target the specific variable format UXDSL uses
    document.documentElement.style.setProperty(`--ds__${varName}`, newHex);
    
    // Dispatch event for other components
    console.log(`[DemoColors] Dispatching event: ${family}-${shade} -> ${newHex}`);
    window.dispatchEvent(new CustomEvent('uxdsl:color-change', { 
      detail: { token: `${family}-${shade}`, value: newHex } 
    }));
    
    // Update local state
    setColorValues({
      hex: newHex.toUpperCase(),
      rgb: newRgb,
      textColor: getContrastColor(newRgb)
    });
  };

  return (
    <li
      ref={ref}
      className={`color-token chip--${family}-${shade}`}
      style={{ color: colorValues.textColor, position: 'relative' }}
    >
      <input 
        type="color" 
        value={colorValues.hex}
        onChange={handleColorChange}
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          opacity: 0, 
          cursor: 'pointer' 
        }}
        aria-label={`Change color for ${family}-${shade}`}
      />
      <span className="token-shade">{shade}</span>
      <div className="token-values">
        <span className="token-hex">{colorValues.hex}</span>
        <span className="token-rgb">{colorValues.rgb}</span>
      </div>
    </li>
  )
}

export default function DemoColors() {
  return (
    <section className="demo-section">
      <div className="demo-header">
        <h3 className="demo-title">Color Scales</h3>
        <p className="demo-subtitle">
          Full spectrum of generated color scales. Click any swatch to adjust the global theme variable.
        </p>
      </div>

      <div className="colors-stack">
        {families.map((fam) => (
          <article key={fam} className="color-family">
            <h4 className="family-title">{fam}</h4>
            <ul className="family-grid">
              {shades.map((shade) => (
                <ColorScaleToken key={shade} family={fam} shade={shade} />
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}
