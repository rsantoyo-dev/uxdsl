'use client'

import { useState, useEffect } from 'react'
import { useBreakpoints } from '@/components/BreakpointsProvider'
import { inspectResponsiveValue } from 'uxdsl/language'
import { Monitor } from 'lucide-react'

// Inspection, not editing. The thresholds shown come from the active theme and
// are compiled into every component's media queries, which is why the runtime
// refuses to move them (UXD_THEME_STRUCTURE). What can be done at run time is
// asking what a responsive value resolves to at a given width — the same
// `inspectResponsiveValue` an editor would use — so the slider below simulates
// a viewport width and the panel reports the active breakpoint, the rule that
// supplies each example value, and the value itself.

const EXAMPLES = [
  { property: 'flex-direction', expression: 'xs(column) md(row)' },
  { property: 'gap', expression: 'xs(space(2)) md(space(4))' },
  { property: 'width', expression: 'xs(100%) lg(50%) xl(33%)' },
]

const MAX_VIZ_WIDTH = 1600

export default function DemoBreakpoints() {
  const { breakpoints } = useBreakpoints()
  const keys = Object.keys(breakpoints).sort((a, b) => breakpoints[a] - breakpoints[b])
  const [windowWidth, setWindowWidth] = useState(0)
  const [simulatedWidth, setSimulatedWidth] = useState(820)

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const activeAt = (width: number) => inspectResponsiveValue('xs(0)', width, breakpoints).active ?? keys[0]
  const activeBp = activeAt(windowWidth)
  const simulatedBp = activeAt(simulatedWidth)

  const getSegmentWidth = (key: string) => {
    const index = keys.indexOf(key)
    const start = breakpoints[key]
    const nextKey = keys[index + 1]
    const end = nextKey ? breakpoints[nextKey] : MAX_VIZ_WIDTH
    return `${((end - start) / MAX_VIZ_WIDTH) * 100}%`
  }

  return (
    <section id="DemoBreakpoints" className="breakpoints-section demo-section">
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
                    className={`breakpoints-segment breakpoints-segment--${key} ${simulatedBp === key ? 'is-active' : ''}`}
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
            {/* Left: Inspection */}
            <div className="breakpoints-controls">
              <h3 className="breakpoints-subtitle">Simulate a viewport width</h3>
              <div className="breakpoints-control-row">
                <div className="breakpoints-control-label">width</div>
                <input
                  type="range"
                  min="0"
                  max={MAX_VIZ_WIDTH}
                  value={simulatedWidth}
                  onChange={(e) => setSimulatedWidth(Number(e.target.value))}
                  className="breakpoints-slider"
                  aria-label="Simulated viewport width"
                />
                <div className="breakpoints-input-wrapper">
                  <input
                    type="number"
                    min="0"
                    max={MAX_VIZ_WIDTH}
                    value={simulatedWidth}
                    onChange={(e) => setSimulatedWidth(Math.max(0, Number(e.target.value) || 0))}
                    className="breakpoints-input-val"
                    aria-label="Simulated viewport width in pixels"
                  />
                  <span className="breakpoints-unit">px</span>
                </div>
              </div>
              {EXAMPLES.map(({ property, expression }) => {
                const result = inspectResponsiveValue(expression, simulatedWidth, breakpoints)
                return (
                  <div key={property} className="breakpoints-control-row" data-testid={`breakpoints-inspect-${property}`}>
                    <code>{property}: {expression};</code>
                    <div className="breakpoints-input-wrapper">
                      <code>{result.value}</code>
                      <span className="breakpoints-unit">from <code>{result.applied ?? '—'}()</code></span>
                    </div>
                  </div>
                )
              })}
              <p className="breakpoints-info-desc">
                The thresholds above are the active theme&apos;s <code>breakpoints</code>. They are compiled into every
                component&apos;s media queries, so <code>applyTheme(&#123; breakpoints: &#123; md: 900 &#125; &#125;)</code> is refused
                with <code>UXD_THEME_STRUCTURE</code>: to move one, change the theme file and rebuild.
              </p>
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
                <span className="breakpoints-info-label">Active in this window</span>
                <strong className="breakpoints-info-value is-large">{String(activeBp).toUpperCase()}</strong>
              </div>
              <div className="breakpoints-info-card is-compact">
                <div className="breakpoints-info-content">
                  <span className="breakpoints-info-label">Active at {simulatedWidth}px</span>
                  <strong className="breakpoints-info-value">{String(simulatedBp).toUpperCase()}</strong>
                </div>
              </div>
              <p className="breakpoints-info-desc">
                Resize the browser to see the active token change; move the slider to inspect any width without resizing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
