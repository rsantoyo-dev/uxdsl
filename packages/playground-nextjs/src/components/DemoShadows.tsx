'use client'

import { useState, useEffect, CSSProperties } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { BreakpointKey } from '@/components/BreakpointsProvider'

const GLOBAL_SHADOWS = [1, 2, 3, 4, 5]

const BP_ORDER: BreakpointKey[] = ['xs', 'sm', 'md', 'lg', 'xl']
const BP_WIDTHS: Record<BreakpointKey, number> = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280
}

const defaultShadows: Record<number, string> = {
  1: '0 1px 2px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.1)',
  2: '0 1px 2px rgba(0, 0, 0, 0.05), 0 2px 6px rgba(0, 0, 0, 0.12)',
  3: '0 2px 4px rgba(0, 0, 0, 0.06), 0 4px 10px rgba(0, 0, 0, 0.14)',
  4: '0 4px 6px rgba(0, 0, 0, 0.08), 0 10px 15px rgba(0, 0, 0, 0.16)',
  5: '0 10px 15px rgba(0, 0, 0, 0.1), 0 20px 25px rgba(0, 0, 0, 0.2)'
}

function parseDefinition(def: string) {
  const result: Record<string, string> = {}
  let currentBp = ''
  let depth = 0
  let buffer = ''
  
  // Simple check if it looks like responsive syntax "xs(...) md(...)"
  // If not, treat as default "xs"
  if (!def.includes('(') || !BP_ORDER.some(bp => def.includes(bp + '('))) {
    return { xs: def }
  }
  
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
}

function generateCss(shadows: typeof defaultShadows) {
  let css = ''
  
  Object.entries(shadows).forEach(([level, def]) => {
    const parsed = parseDefinition(def)
    Object.entries(parsed).forEach(([bp, val]) => {
      const width = BP_WIDTHS[bp as BreakpointKey] || 0
      css += `@media (min-width: ${width}px) {\n          :root { --shadow-${level}: ${resolveValue(val)}; }\n        }\n`
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

    // If only xs is defined and it doesn't look like a function call, just return the value
    // But to be safe and consistent with other editors, we can stick to responsive syntax or just the value if it's simple
    // For simplicity in this demo, let's try to keep it clean.
    // If only xs is present, we can just return the value if we want to support non-responsive syntax,
    // but the parser expects responsive syntax for editing.
    // Let's stick to the responsive syntax generator for consistency.
    
    if (parts.length === 1 && parts[0].startsWith('xs(')) {
       // Optimization: if it's just xs, maybe we can return just the value?
       // But the parser logic above handles "xs(...)" wrapping.
       // Let's just join.
    }

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
                placeholder={bp === 'xs' ? "e.g. 0 1px 2px rgba(0,0,0,0.1)" : "Optional override"}
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

export default function DemoShadows() {
  const [shadow, setShadow] = useState(1)
  const [shadows, setShadows] = useState(defaultShadows)
  const [editingShadow, setEditingShadow] = useState<number | null>(null)

  useEffect(() => {
    const styleId = 'demo-shadows-styles'
    let styleEl = document.getElementById(styleId)
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = generateCss(shadows)
  }, [shadows])

  const generateCode = () => {
    return `.element {
  box-shadow: shadow(${shadow});
  width: 200px;
  height: 200px;
  background: palette(surface-main);
  border-radius: radius(2);
}`
  }

  return (
    <div id="DemoShadows" className="demo-shadows">
      {/* Interactive Playground */}
      <section className="section">
        <h2 className="section-title">Interactive Playground</h2>
        <div className="playground">
          <div className="controls">
            <div className="control-group">
              <label className="control-label">Shadow Level</label>
              <select 
                value={shadow} 
                onChange={(e) => setShadow(Number(e.target.value))}
                className="select"
              >
                {GLOBAL_SHADOWS.map(s => (
                  <option key={s} value={s}>Shadow {s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="preview-area">
            <div className="live-preview">
              <div 
                className="demo-element"
                style={{
                  boxShadow: `var(--shadow-${shadow})`,
                  borderRadius: 'var(--radius-2)'
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
        
        <h3 className="demo-subtitle" style={{ marginTop: '2rem', marginBottom: '1rem' }}>Shadow Presets</h3>
        <div className="grid">
          {GLOBAL_SHADOWS.map((i) => (
            <div 
              key={i} 
              className="card"
              onClick={() => setEditingShadow(i)}
              style={{ cursor: 'pointer', position: 'relative' }}
              title="Click to edit"
            >
              <div 
                className="preview-box"
                style={{ 
                  boxShadow: `var(--shadow-${i})`,
                  borderRadius: 'var(--radius-2)',
                  background: 'var(--ds__palette__surface-main)'
                } as CSSProperties}
              >
                Shadow {i}
              </div>
              <div className="label">shadow-{i}</div>
              <div style={{ 
                position: 'absolute', top: '0.5rem', right: '0.5rem', 
                fontSize: '0.7rem', opacity: 0.5 
              }}>Edit</div>
            </div>
          ))}
        </div>
      </section>

      {editingShadow && (
        <EditTokenDialog 
          title={`Edit Shadow ${editingShadow}`}
          initialDefinition={shadows[editingShadow]}
          onSave={(def) => {
            setShadows(prev => ({ ...prev, [editingShadow]: def }))
            setEditingShadow(null)
          }}
          onClose={() => setEditingShadow(null)}
        />
      )}
    </div>
  )
}
