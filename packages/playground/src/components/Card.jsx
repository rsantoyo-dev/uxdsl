import React from 'react';
import './Card.uxdsl';

export default function Card({ index = 0, variant = 'main' }) {
  return (
    <div className={`card card--${variant}`}>
      <h2 className="card__title">Card #{index + 1}</h2>
      <p className="card__meta">background: palette(primary.{variant})</p>
    </div>
  );
}
