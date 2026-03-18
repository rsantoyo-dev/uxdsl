import React, { useEffect, useMemo, useState } from 'react';
import './DemoTypography.uxdsl';
import { DEFAULT_BREAKPOINTS } from 'postcss-uxdsl/ds-runtime';

// Lazy import runtime utilities similar to App.jsx
async function withRuntime(cb) {
  const mod = await import('postcss-uxdsl/runtime');
  return cb(mod);
}

const DEFAULT_BPS = { ...DEFAULT_BREAKPOINTS };

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
  h1: 'UXDSL: A Design System Language',
  h2: 'Composable, Responsive, Token‑Driven CSS',
  h3: 'Write intent, not breakpoints',
  h4: 'Surface, Button, Typography primitives',
  h5: 'Tokens power palettes, spacing, radii',
  h6: 'Tiny syntax, big ergonomics',
  p: 'UXDSL is a thin layer on top of SCSS/CSS. Keep writing regular styles and progressively add tiny directives (e.g., @ds-typo, @ds-surface, density()) to express design‑system intent. It compiles to plain CSS, so existing code keeps working and no runtime is required.',
  span: 'Declarative, predictable, framework‑agnostic.',
  body: 'The focus is ergonomics: tokens and packs encode system choices (spacing, palette, radii, shadows) while staying fully opt‑in. Use as little or as much DSL as you need; legacy SCSS remains valid and interoperable with UXDSL files.',
  caption: 'Demo content for UXDSL typography',
  small: 'Built for speed and clarity',
  pre: '/* @ds-typo(h2); padding: density(2); */',
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
      case 'h1': return <h1>{text}</h1>;
      case 'h2': return <h2>{text}</h2>;
      case 'h3': return <h3>{text}</h3>;
      case 'h4': return <h4>{text}</h4>;
      case 'h5': return <h5>{text}</h5>;
      case 'h6': return <h6>{text}</h6>;
      case 'p': return <p>{text}</p>;
      case 'span': return <span>{text}</span>;
      case 'caption': return <span className="caption">{text}</span>;
      case 'small': return <small>{text}</small>;
      case 'pre': return <pre>{text}</pre>;
      case 'body':
      default:
        // Fallback to paragraph style for 'body'
        return <p>{text}</p>;
    }
  }

  return (
    <section className="demo-typography">
      <h6>UXDSL Typography</h6>

      <div className="demo-typography__list">
        {VARIANTS.map((v) => (
          <div className="card" key={v}>
            <div className="card-content">
              <small className="">{v} - {currentBp}</small>
              {renderSample(v)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
