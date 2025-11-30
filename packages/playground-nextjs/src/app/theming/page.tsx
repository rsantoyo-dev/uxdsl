export default function ThemingPage() {
  return (
    <main id="ThemingPage" className="main">
      <div className="container">
        <h1 className="section-title">Theming</h1>
        <p>
          App-level overrides live in <code>src/app/theme-def.uxdsl</code>. Update tokens like
          <code>--primary-main</code> to customize the theme.
        </p>
        <div className="palette-grid">
          {['primary','secondary','success','info','warning','error','dark','neutral','light'].map((t) => (
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

