import React, { useEffect, useRef } from 'react';

async function withRuntime(cb) {
  const mod = await import('postcss-uxdsl/runtime');
  return cb(mod);
}

export default function App() {
  const initialPaletteRef = useRef(null);
  // Reapply any saved overrides on load
  useEffect(() => {
    // Load persisted overrides lazily only if present
    try {
      if (localStorage.getItem('uxdsl:palette')) {
        withRuntime(({ loadPersisted }) => loadPersisted());
      }
    } catch {}
    // Snapshot initial computed tokens we care about for reset
    const doc = document.documentElement;
    const cs = getComputedStyle(doc);
    const tokens = [
      'primary-main', 'primary-light', 'primary-dark', 'primary-contrast',
      'light-main', 'light-contrast', 'surface-main', 'surface-contrast',
    ];
    const snapshot = {};
    tokens.forEach((t) => {
      const v = cs.getPropertyValue('--' + t).trim();
      if (v) snapshot[t] = v;
    });
    initialPaletteRef.current = snapshot;
  }, []);

  function setPrimaryBlue() {
    withRuntime(({ applyPalette }) =>
      applyPalette(
        {
          'primary-main': '#2563EB',
          'primary-light': '#3B82F6',
          'primary-dark': '#1D4ED8',
          'primary-contrast': '#FFFFFF',
        },
        { persist: true }
      )
    );
  }

  function setPrimaryGreen() {
    withRuntime(({ applyPalette }) =>
      applyPalette(
        {
          'primary-main': '#059669',
          'primary-light': '#34D399',
          'primary-dark': '#047857',
          'primary-contrast': '#0B1220',
        },
        { persist: true }
      )
    );
  }

  function randomHex() {
    return `#${Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, '0')}`;
  }

  function randomizePrimary() {
    withRuntime(({ applyPalette }) =>
      applyPalette(
        {
          'primary-main': randomHex(),
          'primary-light': randomHex(),
          'primary-dark': randomHex(),
        },
        { persist: true }
      )
    );
  }

  function clearOverrides() {
    withRuntime(({ resetPalette, applyPalette }) => {
      resetPalette(undefined, { clearPersist: true });
      const snap = initialPaletteRef.current || {};
      if (Object.keys(snap).length) applyPalette(snap, { persist: false });
    });
  }
  const COUNT = 5000;
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
      <div className="toolbar">
        <button onClick={setPrimaryBlue}>Primary: Blue</button>
        <button onClick={setPrimaryGreen}>Primary: Green</button>
        <button onClick={randomizePrimary}>Randomize Primary</button>
        <button onClick={clearOverrides}>Reset</button>
      </div>
      
      <p>
        Tokens via <code>theme(primary.*)</code>; responsive via <code>xs()/lg()</code>.
      </p>
      <div className="grid">{cards}</div>
    </div>
  );
}
