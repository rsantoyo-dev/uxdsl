import React, { useMemo } from 'react';
import Card from './Card.jsx';

export default function Performance({ count = 10000 }) {
  const variants = ['light', 'main', 'dark'];
  const cards = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const v = variants[i % variants.length];
      return <Card key={i} index={i} variant={v} />;
    });
  }, [count]);

  return <div className="grid">{cards}</div>;
}

