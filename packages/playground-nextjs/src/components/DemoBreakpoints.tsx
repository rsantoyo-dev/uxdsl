'use client'


import styles from './DemoBreakpoints.module.css'
import { scopedClasses } from '../lib/uxdsl-module-classes'
import { useState, useEffect } from 'react'
import { useBreakpoints, BreakpointKey } from '@/components/BreakpointsProvider'
import { Monitor } from 'lucide-react'

const keys: BreakpointKey[] = ['xs', 'sm', 'md', 'lg', 'xl']

export default function DemoBreakpoints() {
  const { breakpoints, setBreakpoints } = useBreakpoints()
  const [localBreakpoints, setLocalBreakpoints] = useState(breakpoints)
  const [windowWidth, setWindowWidth] = useState(0)
  const [activeBp, setActiveBp] = useState<BreakpointKey>('xs')

  // Sync local state when global breakpoints change (e.g. from reset or initial load)
  useEffect(() => {
    setLocalBreakpoints(breakpoints)
  }, [breakpoints])

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

  const handleLocalUpdate = (key: BreakpointKey, value: number) => {
    const index = keys.indexOf(key)
    if (index === 0) return // xs is always 0

    const prevKey = keys[index - 1]
    const nextKey = keys[index + 1] as BreakpointKey | undefined

    let newVal = value
    
    // Constraint: Must be > prev + 10
    // Use localBreakpoints for constraints to ensure consistency while dragging
    if (newVal <= localBreakpoints[prevKey] + 10) {
      newVal = localBreakpoints[prevKey] + 10
    }

    // Constraint: Must be < next - 10 (if next exists)
    if (nextKey && newVal >= localBreakpoints[nextKey] - 10) {
      newVal = localBreakpoints[nextKey] - 10
    }

    setLocalBreakpoints(prev => ({ ...prev, [key]: newVal }))
  }

  const commitUpdate = () => {
    setBreakpoints(localBreakpoints)
  }

  // Calculate widths for visualization
  const maxVizWidth = 1600
  
  const getSegmentWidth = (key: BreakpointKey) => {
    const index = keys.indexOf(key)
    const start = localBreakpoints[key]
    const nextKey = keys[index + 1] as BreakpointKey | undefined
    const end = nextKey ? localBreakpoints[nextKey] : maxVizWidth
    return ((end - start) / maxVizWidth) * 100 + '%'
  }

  return (
    <section id="DemoBreakpoints" className={scopedClasses('module-root', styles) + ' ' + scopedClasses("breakpoints-section demo-section", styles)}>
      <div className={scopedClasses("breakpoints-playground-wrapper", styles)}>
        <h4 className={scopedClasses("demo-subtitle", styles)}>Interactive Playground</h4>
        
        <div className={scopedClasses("breakpoints-playground-container", styles)}>
          {/* Top: Visualization Bar */}
          <div className={scopedClasses("breakpoints-viz-container", styles)}>
            <div className={scopedClasses("breakpoints-bar-wrapper", styles)}>
              <div className={scopedClasses("breakpoints-bar", styles)}>
                {keys.map(key => (
                  <div 
                    key={key} 
                    className={scopedClasses(`breakpoints-segment breakpoints-segment--${key} ${activeBp === key ? 'is-active' : ''}`, styles)}
                    style={{ width: getSegmentWidth(key) }}
                    title={`${key}: ${localBreakpoints[key]}px`}
                  >
                    <span className={scopedClasses("breakpoints-segment-label", styles)}>{key}</span>
                    <span className={scopedClasses("breakpoints-segment-val", styles)}>≥ {localBreakpoints[key]}px</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom: Grid Layout */}
          <div className={scopedClasses("breakpoints-grid", styles)}>
            {/* Left: Controls */}
            <div className={scopedClasses("breakpoints-controls", styles)}>
              <h3 className={scopedClasses("breakpoints-subtitle", styles)}>Adjust Breakpoints</h3>
              {keys.map(key => (
                <div key={key} className={scopedClasses("breakpoints-control-row", styles)}>
                  <label className={scopedClasses("breakpoints-control-label", styles)} htmlFor={`breakpoint-slider-${key}`}>{key}</label>
                  <input
                    id={`breakpoint-slider-${key}`}
                    type="range"
                    min="0"
                    max="1600"
                    value={localBreakpoints[key]}
                    onChange={(e) => handleLocalUpdate(key, Number(e.target.value))}
                    onMouseUp={commitUpdate}
                    onTouchEnd={commitUpdate}
                    disabled={key === 'xs'}
                    aria-label={`${key} breakpoint slider`}
                    className={scopedClasses("breakpoints-slider", styles)}
                  />
                  <div className={scopedClasses("breakpoints-input-wrapper", styles)}>
                    <input
                      type="number"
                      aria-label={`${key} breakpoint width in pixels`}
                      value={localBreakpoints[key]}
                      onChange={(e) => handleLocalUpdate(key, Number(e.target.value))}
                      onBlur={commitUpdate}
                      onPointerUp={commitUpdate}
                      onKeyDown={(e) => e.key === 'Enter' && commitUpdate()}
                      disabled={key === 'xs'}
                      className={scopedClasses("breakpoints-input-val", styles)}
                    />
                    <span className={scopedClasses("breakpoints-unit", styles)}>px</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Info Panel */}
            <div className={scopedClasses("breakpoints-info-panel", styles)}>
              <div className={scopedClasses("breakpoints-info-card is-compact", styles)}>
                <Monitor size={20} className={scopedClasses("breakpoints-icon", styles)} />
                <div className={scopedClasses("breakpoints-info-content", styles)}>
                  <span className={scopedClasses("breakpoints-info-label", styles)}>Window Width</span>
                  <strong className={scopedClasses("breakpoints-info-value", styles)}>{windowWidth}px</strong>
                </div>
              </div>
              <div className={scopedClasses("breakpoints-info-card is-highlighted", styles)}>
                <span className={scopedClasses("breakpoints-info-label", styles)}>Active Token</span>
                <strong className={scopedClasses("breakpoints-info-value is-large", styles)}>{String(activeBp).toUpperCase()}</strong>
              </div>
              <p className={scopedClasses("breakpoints-info-desc", styles)}>
                Resize your browser window to see the active token change in real-time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
