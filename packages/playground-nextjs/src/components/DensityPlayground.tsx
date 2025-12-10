'use client'

import { useState, useEffect } from 'react'
import { InteractiveDemoContainer } from './InteractiveDemoContainer'
import { Edit2 } from 'lucide-react'
import { BreakpointEditor } from './BreakpointEditor'
import { 
  RussianDoll, 
  generateDensityCss, 
  DEFAULT_DENSITIES,
  MAX_LAYERS
} from '@/components/RussianDoll'

const DEMO_BREAKPOINTS: Record<string, number> = {
  xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536
}

// Highlight active segement of the responsive string
const ResponsiveStringHighlighter = ({ value, windowWidth }: { value: string, windowWidth: number }) => {
  const color = 'var(--ds__palette__info-main)'
  if (!value) return <span style={{ color }}>&quot;&quot;</span>

  // 1. Determine effective pixel width
  // Always use windowWidth since we are in auto mode
  const effectivePx = windowWidth

  // 2. Parse string to find which breakpoints are present
  const presentBps: Record<string, boolean> = {}
  const regex = /(xs|sm|md|lg|xl)\(/g
  let match
  while ((match = regex.exec(value)) !== null) {
    presentBps[match[1]] = true
  }

  if (Object.keys(presentBps).length === 0) return <span style={{ color }}>&quot;{value}&quot;</span>

  // 3. Determine active breakpoint based on width logic (desktop-first standard or mobile-first?)
  // UXDSL usually implies mobile-first (min-width). 
  // We check from largest to smallest. The first one that matches specific criteria.
  // Actually standard logic: largest matching breakpoint wins?
  // Mobile first: keys are min-width. 
  // We find the largest key where width >= breakpoint_width
  const sorted = ['xs', 'sm', 'md', 'lg', 'xl'] // assumed order
  
  // Find highest satisfied breakpoint that EXISTS in the string? 
  // No, CSS rules apply regardless. But we want to highlight the *rule* that wins.
  // The rule that wins is the highest satisfied breakpoint that has a definition, 
  // OR if a higher breakpoint is satisfied but has no definition, it falls back to the previous defined one?
  // CSS inheritance: last matching rule wins.
  
  // Let's find the current screen breakpoint state first
  let screenBp = 'xs'
  for (const bp of sorted) {
    if (effectivePx >= DEMO_BREAKPOINTS[bp]) {
      screenBp = bp
    }
  }

  // Now find the winning rule for this screenBp.
  // It's the screenBp itself if defined, or the nearest defined ancestor.
  let winningRuleBp = 'static'
  let found = false
  
  // Walk backwards from screenBp
  const screenIndex = sorted.indexOf(screenBp)
  for (let i = screenIndex; i >= 0; i--) {
    const candidate = sorted[i]
    if (presentBps[candidate]) {
      winningRuleBp = candidate
      found = true
      break
    }
  }
  
  if (!found) {
    // If no breakpoints matched but we have content... well, 'xs' usually implied base.
    // If the string has 'xs(...)', it would have been found.
    // If the string only has 'md(...)', and we are on 'sm', then nothing matches? (transparent)
    // Or does 'xs' implied? No.
  }

  // 4. Render
  const parts: { text: string, type: 'text' | 'bp', bp?: string }[] = []
  const splitRegex = /(xs|sm|md|lg|xl)\(([^)]+)\)/g
  let lastIndex = 0
  
  while ((match = splitRegex.exec(value)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: value.slice(lastIndex, match.index), type: 'text' })
    }
    parts.push({ text: match[0], type: 'bp', bp: match[1] })
    lastIndex = splitRegex.lastIndex
  }
  
  if (lastIndex < value.length) {
    parts.push({ text: value.slice(lastIndex), type: 'text' })
  }

  return (
    <span style={{ color }}>
      &quot;
      {parts.map((part, i) => {
        if (part.type === 'bp') {
          const isActive = part.bp === winningRuleBp
          return (
            <span 
              key={i} 
              style={isActive ? { 
                color: 'var(--ds__palette__secondary-light)', 
                textShadow: '0 0 8px rgba(255, 77, 77, 0.4)',
                fontWeight: 'bold',
                textDecoration: 'underline'
              } : {}}
            >
              {part.text}
            </span>
          )
        }
        return <span key={i}>{part.text}</span>
      })}
      &quot;
    </span>
  )
}

export default function DensityPlayground({ action }: { action?: React.ReactNode }) {
  const [dollLevels, setDollLevels] = useState(7)
  const [densityDefinitions, setDensityDefinitions] = useState(DEFAULT_DENSITIES)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  
  // Simulation State
  const [windowWidth, setWindowWidth] = useState(0)

  useEffect(() => {
    setWindowWidth(window.innerWidth)
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const styleId = 'demo-density-play-styles'
    let styleEl = document.getElementById(styleId)
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }
    // Use container query strategy for the playground demo so it responds to the resizable wrapper
    styleEl.textContent = generateDensityCss(
      densityDefinitions, 
      DEMO_BREAKPOINTS, 
      '.density-playground-wrapper', 
      'container'
    )
  }, [densityDefinitions])

  const currentDefinition = densityDefinitions[dollLevels]

  const handleSaveDefinition = (newDef: string) => {
    setDensityDefinitions(prev => ({
      ...prev,
      [dollLevels]: newDef
    }))
  }

  // Calculate container width for visual simulation
  // The RussianDoll component doesn't inherently scale with 'previewWidth' unless we constrain its wrapper.
  // We'll apply the width to the wrapper div.

  return (
    <InteractiveDemoContainer 
      title="Density & Spacing" 
      action={action}
      toolbar={
         <>
            {/* Level Controls */}
            <div style={{ 
                 display: 'flex', 
                 alignItems: 'center', 
                 gap: '1rem',
                 padding: '0 0.5rem',
                 marginLeft: 'auto'
             }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ds__palette__text-secondary)', textTransform: 'uppercase' }}>
                    Level
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="range"
                      min={1}
                      max={MAX_LAYERS}
                      value={dollLevels}
                      onChange={(e) => setDollLevels(Number(e.target.value))}
                      style={{ width: '100px', cursor: 'pointer' }}
                    />
                    <span style={{ 
                        fontFamily: 'monospace', 
                        fontSize: '0.9rem', 
                        fontWeight: 'bold', 
                        color: 'var(--ds__palette__primary-main)',
                        minWidth: '20px',
                        textAlign: 'center'
                    }}>
                        {dollLevels}
                    </span>
                </div>
            </div>
         </>
      }
    >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1.5rem' }}>
             
             {/* Visualization Container - Responsive wrapper */}
             <div style={{ 
                 flex: 1, 
                 display: 'flex', 
                 justifyContent: 'center',
                 background: 'var(--ds__palette__surface-dark)',
                 borderRadius: '8px',
                 padding: '2rem 1rem',
                 overflow: 'hidden',
                 minHeight: '300px'
             }}>
                 <div 
                    className="density-playground-wrapper"
                    style={{
                    width: '100%',
                    transition: 'width 0.3s ease',
                    borderLeft: '1px solid var(--ds__palette__divider)',
                    borderRight: '1px solid var(--ds__palette__divider)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    containerType: 'inline-size'
                 }}>
                     <span style={{ 
                         position: 'absolute', 
                         top: '-1.5rem', 
                         fontSize: '0.7rem', 
                         color: 'var(--ds__palette__text-disabled)',
                         textTransform: 'uppercase'
                     }}>
                        Auto Width
                     </span>
                     <div className="density-doll-wrapper" style={{ border: 'none', background: 'transparent' }}>
                        <RussianDoll densityIndex={dollLevels} />
                     </div>
                 </div>
             </div>

             {/* Editable JSON Section */}
             <div style={{
                background: 'var(--ds__palette__surface-main)',
                padding: '1rem',
                borderRadius: '6px',
                border: '1px dashed var(--ds__palette__neutral-main)',
                fontFamily: 'var(--font-code)',
                fontSize: '0.9rem',
                color: 'var(--ds__palette__primary-dark)',
                overflowX: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
             }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                   <div>
                       <span style={{ fontWeight: 600 }}>density({dollLevels})</span>: {'{'}
                   </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingLeft: '2ch' }}>
                  <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                     <span style={{ color: 'var(--ds__palette__secondary-main)' }}>&quot;value&quot;</span>: <ResponsiveStringHighlighter value={currentDefinition} windowWidth={windowWidth} />
                  </div>
                  <button 
                    onClick={() => setIsEditorOpen(true)}
                    title="Edit Density"
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--ds__palette__divider)',
                      borderRadius: '4px',
                      padding: '4px',
                      cursor: 'pointer',
                      color: 'var(--ds__palette__text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                      marginLeft: '1rem'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--ds__palette__primary-main)'
                      e.currentTarget.style.borderColor = 'var(--ds__palette__primary-main)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--ds__palette__text-secondary)'
                      e.currentTarget.style.borderColor = 'var(--ds__palette__divider)'
                    }}
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
                <div>{'}'}</div>
             </div>
        </div>

        <BreakpointEditor 
            isOpen={isEditorOpen}
            onClose={() => setIsEditorOpen(false)}
            initialValue={currentDefinition}
            onSave={handleSaveDefinition}
            tagName={`density(${dollLevels})`}
            editorType="text"
            options={Array.from({ length: 16 }, (_, i) => `space(${i + 1})`)}
        />
    </InteractiveDemoContainer>
  )
}

