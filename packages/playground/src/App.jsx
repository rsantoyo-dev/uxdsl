import React, { useEffect, useRef } from 'react';
import Card from './components/Card.jsx';

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
      if (localStorage.getItem('uxdsl:breakpoints')) {
        withRuntime(({ breakpoints }) => breakpoints.load());
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

  // Demo: Breakpoint runtime controls
  function setMd900() {
    withRuntime(({ breakpoints }) => breakpoints.update('md', 900, { persist: true }));
  }

  function setLg1200() {
    withRuntime(({ breakpoints }) => breakpoints.update('lg', 1200, { persist: true }));
  }

  function resetBps() {
    withRuntime(({ breakpoints }) => breakpoints.reset(undefined, { clearPersist: true }));
  }
  const COUNT = 5000;
  const variants = ['light', 'main', 'dark'];
  const cards = Array.from({ length: COUNT }, (_, i) => {
    const v = variants[i % variants.length];
    return <Card key={i} index={i} variant={v} />;
  });

  return (
    <div className="app">
      <h1 className="hello">UXDSL Theme Demo</h1>
      <div className="toolbar">
        <button onClick={setPrimaryBlue}>Primary: Blue</button>
        <button onClick={setPrimaryGreen}>Primary: Green</button>
        <button onClick={randomizePrimary}>Randomize Primary</button>
        <button onClick={clearOverrides}>Reset</button>
        <span style={{ marginLeft: 8, opacity: 0.7 }}>|</span>
        <button onClick={setMd900}>md = 900px</button>
        <button onClick={setLg1200}>lg = 1200px</button>
        <button onClick={resetBps}>Reset breakpoints</button>
      </div>
      
      <p>
        Tokens via <code>theme(primary.*)</code>; responsive via <code>xs()/lg()</code>.
      </p>
      <div className="grid">{cards}</div>
    </div>
  );
}
