export default function DemoSpacing() {
  const MAX = 2
  const layers = Array.from({ length: MAX }, (_, i) => i + 1)

  const samples = Array.from({ length: 8 }, (_, i) => i + 1)

  return (
    <div className="demo-section">
      <h3 className="demo-title">Russian doll spacing</h3>
      <div className="spacing-demo">
        {layers.map((n) => (
          <div key={n} className={`spacing-demo__layer spacing-demo__layer--${n}`}>
            <div className="spacing-demo__label">{n}</div>
          </div>
        ))}
      </div>

      <h3 className="demo-title" style={{ marginTop: '1.5rem' }}>Space tokens</h3>
      <div className="spacing-grid">
        {samples.map((n) => (
          <div key={n} className="palette-swatch">
            <div className="palette-swatch__title">space({n})</div>
            <div className="palette-swatch__rows">
              <div className="row">
                <div className="space-box">
                  <div className={`space-box__inner pad--${n}`}>
                    padding: var(--space-{n})
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

