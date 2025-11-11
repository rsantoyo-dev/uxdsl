import React from 'react';
import './Card.uxdsl';

// Container-only Card: renders a variant wrapper around children
export default function Card({ variant = '', children }) {
  return <div className={`card card--${variant}`}>{children}</div>;
}
