export default function DensitiesPage() {
  const samples = [1, 2, 3, 4, 5, 6]
  return (
    <main className="main">
      <div className="container">
        <h1 className="section-title">Densities</h1>
        <p>
          density(n) expands responsively across breakpoints, mapping to space() steps. Useful for
          consistent padding and radius that scale from mobile to desktop.
        </p>
        <div className="density-grid">
          {samples.map((n) => (
            <div key={n} className={`density-box density-box--${n}`}>
              <div className="density-box__title">density({n})</div>
              <div className="density-box__content">Padding scales at each breakpoint</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

