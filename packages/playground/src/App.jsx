import React from 'react';

export default function App() {
  const COUNT = 10000;
  const variants = ['light', 'main', 'dark'];
  const cards = Array.from({ length: COUNT }, (_, i) => {
    const v = variants[i % variants.length];
    return (
      <div key={i} className={`card card--${v}`}>
        <h2 className="card__title">Card #{i + 1}</h2>
        <p className="card__meta">background: theme(primary.{v})</p>
      </div>
    );
  });

  return (
    <div className="app">
      <h1 className="hello">UXDSL Theme Demo</h1>
      <p>
        Tokens via <code>theme(primary.*)</code>; responsive via <code>xs()/lg()</code>.
      </p>
      <div className="grid">{cards}</div>
    </div>
  );
}
