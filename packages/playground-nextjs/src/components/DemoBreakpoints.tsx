'use client'

import { useState, useEffect } from 'react'
import { useBreakpoints, BreakpointKey } from '@/components/BreakpointsProvider'
import { Monitor } from 'lucide-react'

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
      <div className="breakpoints-playground-wrapper">
        <h4 className="demo-subtitle">Interactive Playground</h4>
        
        <div className="breakpoints-playground-container">
          {/* Top: Visualization Bar */}
          <div className="breakpoints-viz-container">
            <div className="breakpoints-bar-wrapper">
              <div className="breakpoints-bar">
                {keys.map(key => (
                  <div 
                    key={key} 
                    className={`breakpoints-segment breakpoints-segment--${key} ${activeBp === key ? 'is-active' : ''}`}
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

          {/* Bottom: Grid Layout */}
          <div className="breakpoints-grid">
            {/* Left: Controls */}
            <div className="breakpoints-controls">
              <h3 className="breakpoints-subtitle">Adjust Breakpoints</h3>
              {keys.map(key => (
                <div key={key} className="breakpoints-control-row">
                  <div className="breakpoints-control-label">{key}</div>
                  <input
                    type="range"
                    min="0"
                    max="1600"
                    value={breakpoints[key]}
                    onChange={(e) => handleUpdate(key, Number(e.target.value))}
                    disabled={key === 'xs'}
                    className="breakpoints-slider"
                  />
                  <div className="breakpoints-input-wrapper">
                    <input
                      type="number"
                      value={breakpoints[key]}
                      onChange={(e) => handleUpdate(key, Number(e.target.value))}
                      disabled={key === 'xs'}
                      className="breakpoints-input-val"
                    />
                    <span className="breakpoints-unit">px</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Info Panel */}
            <div className="breakpoints-info-panel">
              <div className="breakpoints-info-card is-compact">
                <Monitor size={20} className="breakpoints-icon" />
                <div className="breakpoints-info-content">
                  <span className="breakpoints-info-label">Window Width</span>
                  <strong className="breakpoints-info-value">{windowWidth}px</strong>
                </div>
              </div>
              <div className="breakpoints-info-card is-highlighted">
                <span className="breakpoints-info-label">Active Token</span>
                <strong className="breakpoints-info-value is-large">{activeBp.toUpperCase()}</strong>
              </div>
              <p className="breakpoints-info-desc">
                Resize your browser window to see the active token change in real-time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
