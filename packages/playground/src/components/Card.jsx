import React from 'react';
import './Card.uxdsl';

export default function Card({ index = 0, variant = 'main' }) {
  return (
    <div className={`card card--${variant}`}>
      <h2 className="card__title dsl-typo">Card #{index + 1}</h2>
      <p className="card__meta dsl-typo">background: palette(primary.{variant})</p>
    </div>
  );
}
