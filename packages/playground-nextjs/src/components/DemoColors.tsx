"use client"

import { useEffect, useRef, useState } from "react"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTheme } from './ThemeContext'

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
  const linear = values.slice(0, 3).map(value => {
    const channel = Number(value) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.179 ? '#000000' : '#ffffff';
}

function hexToRgbString(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

function ColorScaleToken({
  family,
  shade,
  onTokenChange,
  valueHint,
  isDark,
}: {
  family: string;
  shade: string;
  onTokenChange: (token: string, value: string) => void;
  valueHint?: string;
  isDark: boolean;
}) {
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
  }, [family, shade, valueHint, isDark])

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHex = e.target.value;
    const newRgb = hexToRgbString(newHex);
    onTokenChange(`${family}-${shade}`, newHex)
    
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
      style={{ color: colorValues.textColor }}
    >
      <input
        type="color"
        value={colorValues.hex}
        onChange={handleColorChange}
        className="color-picker-overlay"
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
  const { activeThemeData, setCustomTheme, customThemeName, isDark } = useTheme()
  const [bgFamily, setBgFamily] = useState('blue')
  const [bgShade, setBgShade] = useState('600')
  const [textFamily, setTextFamily] = useState('gray')
  const [textShade, setTextShade] = useState('50')

  const handleTokenChange = (token: string, value: string) => {
    const [family, shade] = token.split('-')
    if (!family || !shade) return

    setCustomTheme(customThemeName || 'Custom Theme', { colors: { [family]: { [shade]: value } } })
  }

  return (
    <section id="DemoColors" className="demo-section">
      <div className="demo-header">
        <p className="demo-subtitle">
          Full spectrum of generated color scales. Click any swatch to adjust the global theme variable.
          <br />
          Usage example: <code>background: color(blue-500)</code>
        </p>
      </div>

      <div className="surfaces-playground-container">
        <h4 className="demo-subtitle">Interactive Playground</h4>
        <div className="surface-playground">
           <div className="surface-playground__controls">
             <label>
               <span>Background Family</span>
               <select value={bgFamily} onChange={e => setBgFamily(e.target.value)}>
                 {families.map(f => <option key={f} value={f}>{f}</option>)}
               </select>
             </label>
             <label>
               <span>Background Shade</span>
               <select value={bgShade} onChange={e => setBgShade(e.target.value)}>
                 {shades.map(s => <option key={s} value={s}>{s}</option>)}
               </select>
             </label>
             <label>
               <span>Text Family</span>
               <select value={textFamily} onChange={e => setTextFamily(e.target.value)}>
                 {families.map(f => <option key={f} value={f}>{f}</option>)}
               </select>
             </label>
             <label>
               <span>Text Shade</span>
               <select value={textShade} onChange={e => setTextShade(e.target.value)}>
                 {shades.map(s => <option key={s} value={s}>{s}</option>)}
               </select>
             </label>
           </div>

           <div className="surface-playground__preview">
             <div className="color-live-preview" style={{
               backgroundColor: `var(--uxdsl__color__${bgFamily}-${bgShade})`,
               color: `var(--uxdsl__color__${textFamily}-${textShade})`,
             }}>
               Live Color Preview
             </div>
             
             <div className="demo-code-block" >
               <div className="code-header">
                 <span className="code-file">ColorUsage.uxdsl</span>
               </div>
               <SyntaxHighlighter 
                 language="scss" 
                 style={vscDarkPlus}
                 customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.9rem' }}
                 wrapLines={true}
               >
{`.my-element {
  background-color: color(${bgFamily}-${bgShade});
  color: color(${textFamily}-${textShade});
}`}
               </SyntaxHighlighter>
             </div>
           </div>
        </div>
      </div>

      <div className="demo-header">
        <h3 className="demo-title">Global Palette</h3>
        <p className="demo-subtitle">
          Click on any color swatch to update the UX-DSL token.
        </p>
      </div>

      <div className="colors-stack">
        {families.map((fam) => (
          <article key={fam} className="color-family">
            <h4 className="family-title">{fam}</h4>
            <ul className="family-grid">
              {shades.map((shade) => (
                <ColorScaleToken
                  key={shade}
                  family={fam}
                  shade={shade}
                  onTokenChange={handleTokenChange}
                  valueHint={activeThemeData?.colors?.[fam]?.[shade]}
                  isDark={isDark}
                />
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}
