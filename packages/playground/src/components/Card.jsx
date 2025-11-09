import React from 'react';
import './Card.uxdsl';

export default function Card({ index = 0, variant = 'main', title, meta, children }) {
  const headerText = title ?? `Card #${index + 1}`;
  const metaText = meta ?? `background: palette(primary.${variant})`;
  return (
    <div className={`card card--${variant}`}>
      <h6 className="card__title ds-typo">{headerText}</h6>
      {metaText ? (
        <p className="card__meta ds-typo">{metaText}</p>
      ) : null}
      {children}
    </div>
  );
}
