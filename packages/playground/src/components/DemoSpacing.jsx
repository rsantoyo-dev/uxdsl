import React from 'react';
import './DemoSpacing.uxdsl';

export default function DemoSpacing() {
  const spaceSteps = [1, 2, 3, 4, 5, 6];
  const densitySteps = [1, 2, 3];

  return (
    <section className="demo-spacing">
      <h2>Spacing Demo</h2>

      <h3>space(n)</h3>
      <div className="space-grid">
        {spaceSteps.map((n) => (
          <div key={n} className={`space-box space-${n}`}>
            <small>space({n})</small>
          </div>
        ))}
      </div>

      <h3>density(n)</h3>
      <div className="space-grid">
        {densitySteps.map((n) => (
          <div key={n} className={`density-box density-${n}`}>
            <small>density({n})</small>
          </div>
        ))}
      </div>

      <h3>gap: densities(1, 2, 3)</h3>
      <div className="gap-demo">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="gap-item">
            <small>item {i + 1}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

