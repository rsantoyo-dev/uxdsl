'use client'

import { useState, useEffect, CSSProperties } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { BreakpointKey } from '@/components/BreakpointsProvider'


const BORDER_STYLES = ['solid', 'dashed', 'dotted', 'double']
const RADII = ['pill', 'full', 'circle']
const COLORS = ['primary-main', 'secondary-main', 'error-main', 'success-main', 'neutral-main']

const GLOBAL_BORDERS = [1, 2, 3, 4, 5]
const GLOBAL_RADII = [1, 2, 3, 4, 5]

const BP_ORDER: BreakpointKey[] = ['xs', 'sm', 'md', 'lg', 'xl']
const BP_WIDTHS: Record<BreakpointKey, number> = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280
}

const defaultBorders: Record<number, string> = {
  1: 'xs(1px solid color(gray.300))',
  2: 'xs(space(1) solid color(gray.300))',
  3: 'xs(density(2) solid color(gray.400))',
  4: 'xs(density(3) solid color(gray.500))',
  5: 'xs(density(4) solid color(gray.600))'
}

const defaultRadii: Record<number, string> = {
  1: 'xs(space(1))',
  2: 'xs(space(2))',
  3: 'xs(space(3))',
  4: 'xs(space(4))',
  5: 'xs(space(6))'
}

function parseDefinition(def: string) {
  const result: Record<string, string> = {}
  let currentBp = ''
  let depth = 0
  let buffer = ''
  
  for (let i = 0; i < def.length; i++) {
    const char = def[i]
    
    if (char === '(') {
      if (depth === 0) {
        // Start of value
        currentBp = buffer.trim()
        buffer = ''
      } else {
        buffer += char
      }
      depth++
    } else if (char === ')') {
      depth--
      if (depth === 0) {
        // End of value
        if (currentBp) {
          result[currentBp] = buffer
        }
        buffer = ''
        currentBp = ''
      } else {
        buffer += char
      }
    } else {
      buffer += char
    }
  }
  return result
}

function resolveValue(val: string) {
  if (!val) return ''
  return val
    .replace(/color\(([^)]+)\)/g, (_, p1) => {
      const token = p1.replace('.', '-')
      return `var(--ds__color__${token})`
    })
    .replace(/palette\(([^)]+)\)/g, (_, p1) => {
      const token = p1.replace('.', '-')
      return `var(--ds__palette__${token})`
    })
    .replace(/density\(([^)]+)\)/g, 'var(--density-$1)')
    .replace(/space\(([^)]+)\)/g, 'var(--space-$1)')
}

function generateCss(borders: typeof defaultBorders, radii: typeof defaultRadii) {
  let css = ''
  
  Object.entries(borders).forEach(([level, def]) => {
    const parsed = parseDefinition(def)
    Object.entries(parsed).forEach(([bp, val]) => {
      const width = BP_WIDTHS[bp as BreakpointKey] || 0
      css += `@media (min-width: ${width}px) {\n          :root { --border-${level}: ${resolveValue(val)}; }\n        }\n`
    })
  })

  Object.entries(radii).forEach(([level, def]) => {
    const parsed = parseDefinition(def)
    Object.entries(parsed).forEach(([bp, val]) => {
      const width = BP_WIDTHS[bp as BreakpointKey] || 0
      css += `@media (min-width: ${width}px) {\n          :root { --radius-${level}: ${resolveValue(val)}; }\n        }\n`
    })
  })

  return css
}

function EditTokenDialog({
  title,
  initialDefinition,
  onSave,
  onClose,
}: {
  title: string
  initialDefinition: string
  onSave: (def: string) => void
  onClose: () => void
}) {
  const [breakpointValues, setBreakpointValues] = useState<Record<string, string>>({})

  useEffect(() => {
    setBreakpointValues(parseDefinition(initialDefinition))
  }, [initialDefinition])

  const handleSave = () => {
    const parts: string[] = []
    
    BP_ORDER.forEach(bp => {
      const rawVal = breakpointValues[bp]
      if (!rawVal || !rawVal.trim()) return
      parts.push(`${bp}(${rawVal.trim()})`)
    })

    onSave(parts.join(' '))
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
    }} onClick={onClose}>
      <div style={{
        background: 'var(--ds__palette__surface-main)', padding: '2rem', borderRadius: '8px',
        width: '500px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>{title}</h3>
        
        <p style={{ fontSize: '0.9rem', opacity: 0.7, margin: '0 0 1.5rem 0', lineHeight: 1.5 }}>
          Define styles for each breakpoint. The <strong>Default (xs)</strong> style applies to all screen sizes unless overridden by a larger breakpoint.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {BP_ORDER.map(bp => (
            <label key={bp} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ width: '90px', fontWeight: 'bold', opacity: 0.7 }}>
                {bp === 'xs' ? 'Default (xs)' : bp}
              </span>
              <input 
                type="text"
                value={breakpointValues[bp] || ''}
                onChange={e => setBreakpointValues(prev => ({ ...prev, [bp]: e.target.value }))}
                placeholder={bp === 'xs' ? "e.g. value" : "Optional override"}
                style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} style={{ 
            padding: '0.5rem 1rem', background: 'var(--ds__palette__primary-main)', 
            color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' 
          }}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default function DemoBorders() {
  const [width, setWidth] = useState(1)
  const [style, setStyle] = useState('solid')
  const [color, setColor] = useState('primary-main')
  const [radius, setRadius] = useState<string | number>(2)
  
  const [borders, setBorders] = useState(defaultBorders)
  const [radii, setRadii] = useState(defaultRadii)
  
  const [editingBorder, setEditingBorder] = useState<number | null>(null)
  const [editingRadius, setEditingRadius] = useState<number | null>(null)

  useEffect(() => {
    const styleId = 'demo-borders-styles'
    let styleEl = document.getElementById(styleId)
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = generateCss(borders, radii)
  }, [borders, radii])

  const generateCode = () => {
    return `.element {
  border: border(${width}, palette(${color}), ${style});
  border-radius: radius(${radius});
  width: 200px;
  height: 200px;
}`
  }

  const getRadiusValue = (r: string | number) => {
    if (r === 'pill') return '9999px'
    if (r === 'circle') return '50%'
    if (r === 'full') return '100%'
    return `var(--radius-${r})`
  }

  return (
    <div id="DemoBorders" className="demo-borders">
      {/* Interactive Playground */}
      <section className="section">
        <h2 className="section-title">Interactive Playground</h2>
        <div className="playground">
          <div className="controls">
            <div className="control-group">
              <label className="control-label">Width (Preset)</label>
              <select 
                value={width} 
                onChange={(e) => setWidth(Number(e.target.value))}
                className="select"
              >
                {[1, 2, 3, 4, 5].map(w => (
                  <option key={w} value={w}>Preset {w}</option>
                ))}
              </select>
            </div>

            <div className="control-group">
              <label className="control-label">Style</label>
              <select 
                value={style} 
                onChange={(e) => setStyle(e.target.value)}
                className="select"
              >
                {BORDER_STYLES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="control-group">
              <label className="control-label">Color</label>
              <select 
                value={color} 
                onChange={(e) => setColor(e.target.value)}
                className="select"
              >
                {COLORS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="control-group">
              <label className="control-label">Radius</label>
              <select 
                value={radius} 
                onChange={(e) => {
                  const val = e.target.value
                  setRadius(isNaN(Number(val)) ? val : Number(val))
                }}
                className="select"
              >
                {[1, 2, 3, 4, 5, ...RADII].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="preview-area">
            <div className="live-preview">
              <div 
                className="demo-element"
                style={{
                  border: `var(--border-${width})`,
                  borderStyle: style,
                  borderColor: `var(--ds__palette__${color})`,
                  borderRadius: getRadiusValue(radius)
                } as CSSProperties}
              >
                Preview
              </div>
            </div>
            <div className="demo-code-block">
              <SyntaxHighlighter
                language="css"
                style={vscDarkPlus}
                customStyle={{ margin: 0, borderRadius: 0 }}
              >
                {generateCode()}
              </SyntaxHighlighter>
            </div>
          </div>
        </div>
      </section>

      {/* Global Tokens Section */}
      <section className="section">
        <h2 className="section-title">Global Tokens</h2>
        
        <h3 className="demo-subtitle" style={{ marginTop: '2rem', marginBottom: '1rem' }}>Border Presets</h3>
        <div className="grid">
          {GLOBAL_BORDERS.map((i) => (
            <div 
              key={i} 
              className="card"
              onClick={() => setEditingBorder(i)}
              style={{ cursor: 'pointer', position: 'relative' }}
              title="Click to edit"
            >
              <div 
                className="preview-box"
                style={{ 
                  border: `var(--border-${i})`,
                  borderRadius: 'var(--radius-2)'
                } as CSSProperties}
              >
                Preset {i}
              </div>
              <div className="label">border-{i}</div>
              <div style={{ 
                position: 'absolute', top: '0.5rem', right: '0.5rem', 
                fontSize: '0.7rem', opacity: 0.5 
              }}>Edit</div>
            </div>
          ))}
        </div>

        <h3 className="demo-subtitle" style={{ marginTop: '2rem', marginBottom: '1rem' }}>Radius Presets</h3>
        <div className="grid">
          {GLOBAL_RADII.map((i) => (
            <div 
              key={i} 
              className="card"
              onClick={() => setEditingRadius(i)}
              style={{ cursor: 'pointer', position: 'relative' }}
              title="Click to edit"
            >
              <div 
                className="preview-box"
                style={{ 
                  border: 'var(--border-1)',
                  borderRadius: `var(--radius-${i})`
                } as CSSProperties}
              >
                Radius {i}
              </div>
              <div className="label">radius-{i}</div>
              <div style={{ 
                position: 'absolute', top: '0.5rem', right: '0.5rem', 
                fontSize: '0.7rem', opacity: 0.5 
              }}>Edit</div>
            </div>
          ))}
        </div>
      </section>





      {editingBorder && (
        <EditTokenDialog 
          title={`Edit Border ${editingBorder}`}
          initialDefinition={borders[editingBorder]}
          onSave={(def) => {
            setBorders(prev => ({ ...prev, [editingBorder]: def }))
            setEditingBorder(null)
          }}
          onClose={() => setEditingBorder(null)}
        />
      )}

      {editingRadius && (
        <EditTokenDialog 
          title={`Edit Radius ${editingRadius}`}
          initialDefinition={radii[editingRadius]}
          onSave={(def) => {
            setRadii(prev => ({ ...prev, [editingRadius]: def }))
            setEditingRadius(null)
          }}
          onClose={() => setEditingRadius(null)}
        />
      )}
    </div>
  )
}
