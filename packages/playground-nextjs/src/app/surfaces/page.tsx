export default function SurfacesPage() {
  const tones = ['primary','secondary','success','info','warning','error','dark','neutral','light'] as const
  return (
    <main className="main">
      <div className="container">
        <h1 className="section-title">Surfaces</h1>
        <div className="palette-grid">
          {tones.map((t) => (
            <div key={t} className={`palette-swatch surface--${t}`}>
              <div className="palette-swatch__title">{t}</div>
              <div className="palette-swatch__rows">
                <div className="row"><span className="label">bg:</span><span className="value">palette({t}-main)</span></div>
                <div className="row"><span className="label">fg:</span><span className="value">palette({t}-contrast)</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

