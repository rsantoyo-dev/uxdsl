'use client'

import { useState, useEffect } from 'react'
import { useBreakpoints, BreakpointKey } from '@/components/BreakpointsProvider'

const keys: BreakpointKey[] = ['xs', 'sm', 'md', 'lg', 'xl']

export default function DemoBreakpoints() {
  const { breakpoints, setBreakpoints } = useBreakpoints()
  const [windowWidth, setWindowWidth] = useState(0)
  const [activeBp, setActiveBp] = useState<BreakpointKey>('xs')

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth
      setWindowWidth(w)
      
      // Calculate active breakpoint based on dynamic context values
      let current: BreakpointKey = 'xs'
      for (const key of keys) {
        if (w >= breakpoints[key]) {
          current = key
        }
      }
      setActiveBp(current)
    }

    handleResize() // Initial check
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoints])

  const handleUpdate = (key: BreakpointKey, value: number) => {
    const index = keys.indexOf(key)
    if (index === 0) return // xs is always 0

    const prevKey = keys[index - 1]
    const nextKey = keys[index + 1] as BreakpointKey | undefined

    let newVal = value
    
    // Constraint: Must be > prev + 10
    if (newVal <= breakpoints[prevKey] + 10) {
      newVal = breakpoints[prevKey] + 10
    }

    // Constraint: Must be < next - 10 (if next exists)
    if (nextKey && newVal >= breakpoints[nextKey] - 10) {
      newVal = breakpoints[nextKey] - 10
    }

    setBreakpoints(prev => ({ ...prev, [key]: newVal }))
  }

  // Calculate widths for visualization
  const maxVizWidth = 1600
  
  const getSegmentWidth = (key: BreakpointKey) => {
    const index = keys.indexOf(key)
    const start = breakpoints[key]
    const nextKey = keys[index + 1] as BreakpointKey | undefined
    const end = nextKey ? breakpoints[nextKey] : maxVizWidth
    return ((end - start) / maxVizWidth) * 100 + '%'
  }

  return (
    <section className="breakpoints-section demo-section">
      <h2 className="section-title">Interactive Playground</h2>

      {/* Live Monitor Bar */}
      <div style={{ 
        background: 'var(--ds__palette__surface-dark)', 
        color: 'var(--ds__palette__surface-contrast)',
        padding: '1rem', 
        borderRadius: '8px', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: 'monospace',
        border: '1px solid var(--ds__palette__primary-main)',
        marginBottom: '2rem'
      }}>
        <div>
          Window Width: <strong style={{ color: 'var(--ds__palette__primary-light)' }}>{windowWidth}px</strong>
        </div>
        <div>
          Active Token: <strong style={{ color: 'var(--ds__palette__secondary-light)', fontSize: '1.2rem' }}>{activeBp.toUpperCase()}</strong>
        </div>
      </div>

      <div className="breakpoints-viz-container" style={{ marginBottom: '2rem' }}>
        <div className="breakpoints-bar-wrapper">
          <div className="breakpoints-bar">
            {keys.map(key => (
              <div 
                key={key} 
                className={`breakpoints-segment breakpoints-segment--${key}`}
                style={{ width: getSegmentWidth(key) }}
                title={`${key}: ${breakpoints[key]}px`}
              >
                <span className="breakpoints-segment-label">{key}</span>
                <span className="breakpoints-segment-val">≥ {breakpoints[key]}px</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="breakpoints-controls">
        {keys.map(key => (
          <div key={key} className="breakpoints-control-row" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ width: '40px', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.9rem' }}>{key}</div>
            <input
              type="range"
              min="0"
              max="1600"
              value={breakpoints[key]}
              onChange={(e) => handleUpdate(key, Number(e.target.value))}
              disabled={key === 'xs'} // xs is locked
              className="breakpoints-slider"
              style={{ flex: 1, cursor: key === 'xs' ? 'not-allowed' : 'pointer' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="number"
                value={breakpoints[key]}
                onChange={(e) => handleUpdate(key, Number(e.target.value))}
                disabled={key === 'xs'}
                className="breakpoints-input-val"
                style={{ 
                  width: '70px', 
                  padding: '0.5rem', 
                  borderRadius: '4px', 
                  border: '1px solid var(--ds__palette__tertiary-light)',
                  background: 'var(--ds__palette__surface-main)',
                  color: 'var(--ds__palette__surface-contrast)'
                }}
              />
              <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>px</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
