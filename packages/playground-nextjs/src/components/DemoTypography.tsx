'use client'

import { useEffect, useState } from 'react'
import runtime from 'postcss-uxdsl/ds-runtime'

const typographyItems = [
  { tag: 'h1', label: 'H1', text: 'UXDSL: The Design System Language', className: 'sample-h1' },
  { tag: 'h2', label: 'H2', text: 'The Evolution of Styling', className: 'sample-h2' },
  { tag: 'h3', label: 'H3', text: 'Atomic vs Semantic', className: 'sample-h3' },
  { tag: 'h4', label: 'H4', text: 'The rise of design tokens', className: 'sample-h4' },
  { tag: 'h5', label: 'H5', text: 'Runtime adaptability', className: 'sample-h5' },
  { tag: 'h6', label: 'H6', text: 'Future of CSS generation', className: 'sample-h6' },
  { tag: 'p', label: 'P', text: 'UXDSL bridges the gap between design tokens and CSS generation, allowing for a truly semantic and adaptable design system that scales with your application.', className: 'sample-p' },
  { tag: 'span', label: 'SPAN', text: 'Inline token usage', className: 'sample-span' },
  { tag: 'body', label: 'BODY', text: 'UXDSL provides a type-safe, token-aware styling experience that integrates seamlessly with modern frameworks.', className: 'sample-body' },
  { tag: 'caption', label: 'CAPTION', text: 'Figure 1: Token dependency graph', className: 'sample-caption' },
  { tag: 'small', label: 'SMALL', text: 'v1.0.0-beta', className: 'sample-small' },
  { tag: 'pre', label: 'PRE', text: 'const theme = { colors: { primary: \'blue\' } };', className: 'sample-pre' },
]

const fontFamilies = [
  { name: 'UI (Default)', value: 'var(--font-ui)' },
  { name: 'UI Secondary', value: 'var(--font-ui-2)' },
  { name: 'Monospace', value: 'var(--font-code)' },
  { name: 'Serif', value: 'Georgia, Cambria, "Times New Roman", Times, serif' },
  { name: 'Cursive', value: 'cursive' },
]

const fontWeights = ['100', '200', '300', '400', '500', '600', '700', '800', '900']

function useBreakpoint() {
  const [bp, setBp] = useState('')

  useEffect(() => {
    // Default standard breakpoints if runtime doesn't provide them immediately
    const defaults = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 }
    
    const getBp = () => {
      const width = window.innerWidth
      // Try to get from runtime, fallback to defaults
      const breakpoints = runtime.getBreakpoints() as Record<string, number>
      const activeBps = (breakpoints && Object.keys(breakpoints).length > 0) ? breakpoints : defaults
      
      const sorted = Object.entries(activeBps).sort((a, b) => a[1] - b[1])
      
      let current = 'xs'
      for (const [name, val] of sorted) {
        if (width >= (val as number)) {
          current = name
        }
      }
      return current
    }

    const handleResize = () => setBp(getBp())
    
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return bp
}

const breakpointsMap = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536
}

const overrides: Record<string, string> = {}
const rules: Record<string, string> = {}

function updateOverrides() {
  let styleEl = document.getElementById('uxdsl-typo-overrides')
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = 'uxdsl-typo-overrides'
    document.head.appendChild(styleEl)
  }
  styleEl.innerHTML = Object.values(overrides).join('\n')
}

function EditDialog({ item, onClose }: { item: typeof typographyItems[0], onClose: () => void }) {
  const [family, setFamily] = useState('')
  const [weight, setWeight] = useState('')
  const [sizeRule, setSizeRule] = useState('')
  const [currentComputed, setCurrentComputed] = useState('')
  const [currentFamilyComputed, setCurrentFamilyComputed] = useState('')

  useEffect(() => {
    const style = getComputedStyle(document.documentElement)
    const computedFamily = style.getPropertyValue(`--${item.tag}-font-family`).trim()
    setCurrentFamilyComputed(computedFamily)
    
    // Try to match computed family to one of our options
    // This is tricky because options are vars. We need to resolve them.
    let matchedOption = ''
    for (const opt of fontFamilies) {
      if (opt.value.startsWith('var(')) {
        const varName = opt.value.slice(4, -1)
        const resolved = style.getPropertyValue(varName).trim()
        // Check if the computed family matches the resolved var OR the var string itself (if not resolved yet)
        if (computedFamily === resolved || computedFamily === opt.value) {
          matchedOption = opt.value
          break
        }
      } else if (computedFamily.includes(opt.value.split(',')[0])) {
         // Loose match for hardcoded fonts
         matchedOption = opt.value
         break
      }
    }
    
    // If we found a match, use the option value (the var). 
    // If not, use the computed value (so we don't lose it), but select will show "Custom" or empty if not in list.
    setFamily(matchedOption || computedFamily)

    setWeight(style.getPropertyValue(`--${item.tag}-weight`).trim())
    setCurrentComputed(style.getPropertyValue(`--${item.tag}-size`).trim())
    
    if (rules[item.tag]) {
      setSizeRule(rules[item.tag])
    }
  }, [item])

  const handleSave = () => {
    const root = document.documentElement
    if (family) root.style.setProperty(`--${item.tag}-font-family`, family)
    if (weight) root.style.setProperty(`--${item.tag}-weight`, weight)
    
    if (sizeRule) {
      rules[item.tag] = sizeRule 
      
      let css = ''
      const processedRule = sizeRule.replace(/space\((\d+)\)/g, 'var(--space-$1)')
      
      const regex = /(xs|sm|md|lg|xl|2xl)\(([^)]+)\)/g
      let match
      let found = false
      
      regex.lastIndex = 0
      
      while ((match = regex.exec(processedRule)) !== null) {
        found = true
        const bp = match[1]
        const val = match[2]
        const minWidth = breakpointsMap[bp as keyof typeof breakpointsMap]
        
        if (minWidth === 0) {
          css += `:root { --${item.tag}-size: ${val}; }`
        } else {
          css += `@media (min-width: ${minWidth}px) { :root { --${item.tag}-size: ${val}; } }`
        }
      }
      
      if (!found && processedRule.trim()) {
        css = `:root { --${item.tag}-size: ${processedRule}; }`
      }

      if (css) {
        overrides[item.tag] = css
        updateOverrides()
      }
    }
    
    onClose()
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
        <h3 style={{ marginTop: 0 }}>Edit {item.label}</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label>
            Font Family
            <div style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: '0.25rem' }}>
              Current: {currentFamilyComputed || '(unknown)'}
            </div>
            <select 
              value={family} 
              onChange={e => setFamily(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
            >
              <option value="">(Inherit)</option>
              {fontFamilies.map(f => (
                <option key={f.name} value={f.value}>{f.name}</option>
              ))}
              {!fontFamilies.find(f => f.value === family) && family && (
                <option value={family}>Custom ({family})</option>
              )}
            </select>
          </label>

          <label>
            Font Weight
            <select 
              value={weight} 
              onChange={e => setWeight(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
            >
              <option value="">(Inherit)</option>
              {fontWeights.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </label>

          <label>
            Font Size Rule
            <div style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: '0.25rem' }}>
              Current computed: {currentComputed || '(unknown)'}
            </div>
            <input 
              type="text" 
              value={sizeRule} 
              onChange={e => setSizeRule(e.target.value)}
              placeholder="e.g. xs(16px) md(20px) or xs(space(4))"
              style={{ width: '100%', padding: '0.5rem' }}
            />
            <div style={{ fontSize: '0.75em', opacity: 0.6, marginTop: '0.25rem' }}>
              Syntax: <code>xs(val) sm(val) md(val)...</code> or flat value. Supports <code>space(N)</code>.
            </div>
          </label>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} style={{ 
              padding: '0.5rem 1rem', background: 'var(--ds__palette__primary-main)', 
              color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' 
            }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DemoTypography() {
  const bp = useBreakpoint()
  const [editingItem, setEditingItem] = useState<typeof typographyItems[0] | null>(null)

  return (
    <section className="typo-section demo-section">
      <div className="typo-header">
        <p className="demo-subtitle">
          Responsive typography scale. Click any card to edit its properties.
        </p>
      </div>

      <div className="typo-stack">
        {typographyItems.map((item) => (
          <article 
            key={item.label} 
            className="typo-card" 
            onClick={() => setEditingItem(item)}
            style={{ cursor: 'pointer' }}
          >
            <header className="typo-card__header">
              <span className="typo-card__tag">{item.label}-{bp || '...'}</span>
              <span className="typo-card__bp">Current: {bp || 'loading'}</span>
            </header>
            <div className={item.className}>
              {item.text}
            </div>
          </article>
        ))}
      </div>

      {editingItem && (
        <EditDialog item={editingItem} onClose={() => setEditingItem(null)} />
      )}
    </section>
  )
}
