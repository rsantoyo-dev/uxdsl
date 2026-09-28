export default function ThemingPage() {
  return (
    <main id="ThemingPage" className="main">
      <div className="container">
        <h1 className="section-title">Theming</h1>
        {/* MIG-B7-17 phase B (5): this page used to send readers to `src/app/theme-def.uxdsl` and
            a `--primary-main` alias. Those were commented-out, dead code (removed in phase B (4)),
            and a `:root` written there loses to the generated theme anyway. What follows is how
            this site is actually themed. */}
        <p>
          The theme is JSON. This site starts from the base that ships with the package
          (<code>postcss-uxdsl/theme/base.json</code>) and merges one override file per named
          theme over it (<code>uxdsl.theme.green.json</code>, <code>uxdsl.theme.slate.json</code>…) with
          <code>deepMergeTheme</code> in <code>themes.js</code>. <code>uxdsl build</code> compiles the
          default theme through <code>uxdsl.config.cjs</code>; the header&apos;s theme buttons apply
          the others in the browser with <code>applyTheme</code>, without rebuilding.
        </p>
        <p>
          To customize a role, change the JSON — for example <code>palette.primary.main</code> — and
          every <code>palette(primary-main)</code> below follows. The Config page edits the active
          theme&apos;s JSON live.
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
