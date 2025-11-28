'use client';

import { useState } from 'react';

export default function ButtonDemo() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="demo-section">
      <div className="demo-grid demo-grid--3col">
        {/* Primary buttons */}
        <div>
          <h4 className="demo-title" style={{ fontSize: '1rem', marginBottom: '1rem' }}>Primary</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              className="btn"
              aria-pressed={selected === 'primary-contained'}
              onClick={() => setSelected('primary-contained')}
            >
              Contained
            </button>
            <button
              className="btn btn--outlined"
              aria-pressed={selected === 'primary-outlined'}
              onClick={() => setSelected('primary-outlined')}
            >
              Outlined
            </button>
            <button
              className="btn btn--flat"
              aria-pressed={selected === 'primary-flat'}
              onClick={() => setSelected('primary-flat')}
            >
              Flat
            </button>
          </div>
        </div>

        {/* Secondary buttons */}
        <div>
          <h4 className="demo-title" style={{ fontSize: '1rem', marginBottom: '1rem' }}>Secondary</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              className="btn btn--secondary"
              aria-pressed={selected === 'secondary-contained'}
              onClick={() => setSelected('secondary-contained')}
            >
              Contained
            </button>
            <button
              className="btn btn--outlined btn--secondary"
              aria-pressed={selected === 'secondary-outlined'}
              onClick={() => setSelected('secondary-outlined')}
            >
              Outlined
            </button>
            <button
              className="btn btn--flat btn--secondary"
              aria-pressed={selected === 'secondary-flat'}
              onClick={() => setSelected('secondary-flat')}
            >
              Flat
            </button>
          </div>
        </div>

        {/* Size variants */}
        <div>
          <h4 className="demo-title" style={{ fontSize: '1rem', marginBottom: '1rem' }}>Sizes</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              className="btn btn--sm"
              aria-pressed={selected === 'size-sm'}
              onClick={() => setSelected('size-sm')}
            >
              Small
            </button>
            <button
              className="btn btn--md"
              aria-pressed={selected === 'size-md'}
              onClick={() => setSelected('size-md')}
            >
              Medium
            </button>
            <button
              className="btn btn--lg"
              aria-pressed={selected === 'size-lg'}
              onClick={() => setSelected('size-lg')}
            >
              Large
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}