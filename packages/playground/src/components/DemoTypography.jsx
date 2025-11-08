import React, { useEffect, useMemo, useState } from 'react';
import './DemoTypography.uxdsl';
import Card from './Card.jsx';

// Lazy import runtime utilities similar to App.jsx
async function withRuntime(cb) {
  const mod = await import('postcss-uxdsl/runtime');
  return cb(mod);
}

const DEFAULT_BPS = { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 };

function pickCurrentBp(map, width) {
  const entries = Object.entries(map || DEFAULT_BPS)
    .filter(([, v]) => typeof v === 'number' && !Number.isNaN(v))
    .sort((a, b) => a[1] - b[1]);
  let name = entries[0]?.[0] || 'xs';
  for (const [n, px] of entries) {
    if (width >= px) name = n;
  }
  return name;
}

const VARIANTS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'span', 'body', 'caption', 'small', 'pre',
];

const SAMPLES = {
  h1: 'Taxing Laughter: The Joke Tax Chronicles',
  h2: 'The People of the Kingdom',
  h3: 'The Joke Tax',
  h4: 'People stopped telling jokes',
  h5: 'A Fortnight of Silence',
  h6: 'A Royal Change of Heart',
  p: 'The king, seeing how much happier his subjects were, realized the error of his ways and repealed the joke tax.',
  span: 'Inline span text example',
  body: 'Body content example text for layout and rhythm.',
  caption: 'Caption text for images or notes',
  small: 'Small helper text',
  pre: 'const jokeTax = false; // humor is free',
};

export default function DemoTypography() {
  const [bpMap, setBpMap] = useState(DEFAULT_BPS);
  const [width, setWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 0));

  useEffect(() => {
    withRuntime(({ breakpoints }) => setBpMap(breakpoints.get()));
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const currentBp = useMemo(() => pickCurrentBp(bpMap, width), [bpMap, width]);

  function renderSample(variant) {
    const text = SAMPLES[variant] || 'Sample text';
    switch (variant) {
      case 'h1': return <h1 className="ds-typo">{text}</h1>;
      case 'h2': return <h2 className="ds-typo">{text}</h2>;
      case 'h3': return <h3 className="ds-typo">{text}</h3>;
      case 'h4': return <h4 className="ds-typo">{text}</h4>;
      case 'h5': return <h5 className="ds-typo">{text}</h5>;
      case 'h6': return <h6 className="ds-typo">{text}</h6>;
      case 'p': return <p className="ds-typo">{text}</p>;
      case 'span': return <span className="ds-typo">{text}</span>;
      case 'caption': return <span className="ds-typo caption" data-typo="caption">{text}</span>;
      case 'small': return <small className="ds-typo" data-typo="small">{text}</small>;
      case 'pre': return <pre className="ds-typo" data-typo="pre">{text}</pre>;
      case 'body':
      default:
        // Fallback to paragraph style for 'body'
        return <p className="ds-typo">{text}</p>;
    }
  }

  return (
    <section className="demo-typography">
      <h2 className="ds-typo" data-typo="h2">Typography Demo</h2>

      <div className="demo-typography__list">
        {VARIANTS.map((v, i) => {
          const cardVariant = i % 3 === 0 ? 'light' : i % 3 === 1 ? 'main' : 'dark';
          return (
            <Card
              key={v}
              variant={cardVariant}
              title={`${v.toUpperCase()} - ${currentBp}`}
              meta={''}
            >
              {renderSample(v)}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
