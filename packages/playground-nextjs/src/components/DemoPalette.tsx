'use client'

import { useEffect, useRef, useState } from 'react'

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

const colorFamilies = [
  'blue','indigo','purple','pink','red','orange','yellow','green','teal','cyan','gray'
]
const colorShades = ['50','100','200','300','400','500','600','700','800','900']

function useColorMap() {
  const [map, setMap] = useState<Record<string, string>>({})

  const buildMap = () => {
    const container = document.createElement('div')
    container.style.display = 'none'
    document.body.appendChild(container)

    const tokenMap: Record<string, string> = {}
    
    // Temporarily remove overrides to read default values
    const overrides: Record<string, string> = {}
    const docStyle = document.documentElement.style
    
    colorFamilies.forEach(family => {
      colorShades.forEach(shade => {
         const varName = `--ds__color__${family}-${shade}`
         const val = docStyle.getPropertyValue(varName)
         if (val) {
             overrides[varName] = val
             docStyle.removeProperty(varName)
         }
      })
    })

    colorFamilies.forEach(family => {
      colorShades.forEach(shade => {
        const span = document.createElement('span')
        span.style.backgroundColor = `var(--ds__color__${family}-${shade})`
        container.appendChild(span)
        
        const bg = window.getComputedStyle(span).backgroundColor
        const hex = rgbToHex(bg)
        if (hex) {
            // Store mapping for this hex
            // If multiple tokens have same hex, last one wins (usually fine)
            tokenMap[hex] = `${family}-${shade}`
        }
      })
    })
    
    // Restore overrides
    Object.entries(overrides).forEach(([key, val]) => {
        docStyle.setProperty(key, val)
    })

    document.body.removeChild(container)
    setMap(tokenMap)
  }

  useEffect(() => {
    buildMap()
  }, [])
  
  return map
}

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
  
  // Calculate relative luminance
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
}

function hexToRgbString(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

function ColorToken({ tone, variant, colorMap }: { tone: string, variant: string, colorMap: Record<string, string> }) {
  const ref = useRef<HTMLLIElement>(null)
  const [colorValues, setColorValues] = useState({ hex: '', rgb: '', textColor: 'inherit' })
  // Keep track of which token we are currently linked to
  const [linkedToken, setLinkedToken] = useState<string | null>(null)

  // Initial load: read color and find link
  useEffect(() => {
    if (ref.current) {
      const style = window.getComputedStyle(ref.current)
      const bgColor = style.backgroundColor
      const hex = rgbToHex(bgColor)
      
      setColorValues({
        hex: hex,
        rgb: bgColor,
        textColor: getContrastColor(bgColor)
      })

      // If we find a match in the map, establish a link
      // We only do this if we don't have a link yet, to avoid overwriting
      if (colorMap[hex] && !linkedToken) {
        const tokenName = colorMap[hex]
        console.log(`[DemoPalette] Linking ${tone}-${variant} to ${tokenName}`)
        setLinkedToken(tokenName)

        // Check if the linked token has an override
        const overrideVar = `--ds__color__${tokenName}`
        const overrideValue = document.documentElement.style.getPropertyValue(overrideVar)
        
        if (overrideValue && overrideValue.toUpperCase() !== hex) {
             console.log(`[DemoPalette] Found override for ${tokenName}: ${overrideValue}`)
             // Apply it!
             const varName = `${tone}-${variant}`
             document.documentElement.style.setProperty(`--${varName}`, overrideValue)
             document.documentElement.style.setProperty(`--ds__palette__${varName}`, overrideValue)
             
             const newRgb = hexToRgbString(overrideValue)
             setColorValues({
                hex: overrideValue.toUpperCase(),
                rgb: newRgb,
                textColor: getContrastColor(newRgb)
             })
        }
      }
    }
  }, [tone, variant, colorMap, linkedToken])

  // Listen for color changes to update OUR color if we are linked
  useEffect(() => {
    const handleColorChange = (e: Event) => {
      const customEvent = e as CustomEvent
      const { token, value } = customEvent.detail
      
      console.log(`[DemoPalette] Event received: ${token} -> ${value}. My link: ${linkedToken}`)

      // If the changed token is the one we are linked to...
      if (linkedToken === token) {
        const varName = `${tone}-${variant}`
        
        // Update our CSS variable to match the new value
        document.documentElement.style.setProperty(`--${varName}`, value)
        document.documentElement.style.setProperty(`--ds__palette__${varName}`, value)
        
        // Update local state
        const newRgb = hexToRgbString(value)
        setColorValues({
          hex: value,
          rgb: newRgb,
          textColor: getContrastColor(newRgb)
        })
      }
    }

    window.addEventListener('uxdsl:color-change', handleColorChange)
    console.log(`[DemoPalette] Listener attached for ${tone}-${variant} (linked: ${linkedToken})`)
    return () => {
      window.removeEventListener('uxdsl:color-change', handleColorChange)
    }
  }, [linkedToken, tone, variant])

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHex = e.target.value;
    const newRgb = hexToRgbString(newHex);
    const varName = `${tone}-${variant}`;
    
    // Update CSS variables globally
    document.documentElement.style.setProperty(`--${varName}`, newHex);
    document.documentElement.style.setProperty(`--ds__palette__${varName}`, newHex);
    
    // Update local state
    setColorValues({
      hex: newHex.toUpperCase(),
      rgb: newRgb,
      textColor: getContrastColor(newRgb)
    });
    
    // Break the link if we manually change the color
    setLinkedToken(null)
  };

  // Display the linked token if it exists, otherwise check the map for a coincidence
  const displayToken = linkedToken || colorMap[colorValues.hex]

  return (
    <li
      ref={ref}
      className={`palette-token palette-card-${tone}-${variant}`}
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
        aria-label={`Change color for ${tone}-${variant}`}
      />
      <span className="token-name">{tone}-{variant}</span>
      {displayToken && (
        <span className="token-match" style={{ 
          position: 'absolute', 
          top: '0.5rem', 
          right: '0.5rem', 
          fontSize: '0.65em', 
          opacity: 0.8,
          fontWeight: 'bold',
          pointerEvents: 'none'
        }}>
          {displayToken}
        </span>
      )}
      <div className="token-values">
        <span className="token-hex">{colorValues.hex}</span>
        <span className="token-rgb">{colorValues.rgb}</span>
      </div>
    </li>
  )
}

export default function DemoPalette() {
  const colorMap = useColorMap()

  return (
    <section className="palette-section demo-section">
      <div className="palette-header">
        <div>
          <h3 className="demo-title">Palette helpers</h3>
          <p className="demo-subtitle">
            Each card relies purely on <code>palette(tone-variant)</code> helpers.
            Values are computed at runtime from the applied CSS variables.
          </p>
        </div>
      </div>

      <div className="palette-stack">
        {paletteCards.map((tone) => (
          <article key={tone.id} className={`palette-card`}>
            <header className="palette-card__header">
              <h4 className="palette-card__title">{tone.title}</h4>
              <p className="palette-card__detail">{tone.detail}</p>
            </header>

            <ul className="palette-token-list">
              {variants.map((variant) => (
                <ColorToken key={variant.id} tone={tone.id} variant={variant.id} colorMap={colorMap} />
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}
