'use client'

import { useEffect, useState } from 'react'
import { initialTypographyItems } from './TypographyDemoContext'

const AVAILABLE_FONTS = [
  "Inter", "Roboto", "Poppins", "Open Sans", "Montserrat", "Lato", "Raleway", "Noto Sans",
  "Merriweather", "Playfair Display", "Lora", "PT Serif", "Roboto Slab",
  "Roboto Mono", "Source Code Pro", "JetBrains Mono", "Fira Code",
  "Oswald", "Quicksand", "Dancing Script"
];

const fontFamilies = [
  { name: 'System UI (Default)', value: 'var(--font-ui)' },
  { name: 'System UI Secondary', value: 'var(--font-ui-2)' },
  { name: 'System Mono', value: 'var(--font-code)' },
  ...AVAILABLE_FONTS.map(font => ({ name: font, value: font }))
]

const fontWeights = ['100', '200', '300', '400', '500', '600', '700', '800', '900']

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

export function EditDialog({ item, onClose }: { item: typeof initialTypographyItems[0], onClose: () => void }) {
  const [family, setFamily] = useState('')
  const [weight, setWeight] = useState('')
  const [sizeRule, setSizeRule] = useState('')
  const [currentComputed, setCurrentComputed] = useState('')
  const [currentFamilyComputed, setCurrentFamilyComputed] = useState('')

  useEffect(() => {
    const style = getComputedStyle(document.documentElement)
    const computedFamily = style.getPropertyValue(`--${item.tag}-font-family`).trim()
    setCurrentFamilyComputed(computedFamily)
    
    let matchedOption = ''
    for (const opt of fontFamilies) {
      if (opt.value.startsWith('var(')) {
        const varName = opt.value.slice(4, -1)
        const resolved = style.getPropertyValue(varName).trim()
        if (computedFamily === resolved || computedFamily === opt.value) {
          matchedOption = opt.value
          break
        }
      } else if (computedFamily.includes(opt.value.split(',')[0])) {
         matchedOption = opt.value
         break
      }
    }
    
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
      const processedRule = sizeRule.replace(/space(\d+)/g, 'var(--space-$1)')
      
      const regex = /(xs|sm|md|lg|xl|2xl)\((\d+px)\)/g
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
