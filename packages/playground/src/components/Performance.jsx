import React, { useMemo } from 'react';
import './Performance.uxdsl';

export default function Performance({ count = 5000 }) {
  const variants = ['light', 'main', 'dark'];
  const cards = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const v = variants[i % variants.length];
      return (
        <div key={i} className={`perf-card perf-card--${v}`}>
          <h6 className="perf-card__title">{i} · {v}</h6>
        </div>
      );
    });
  }, [count]);

  return <div className="perf-grid">{cards}</div>;
}
