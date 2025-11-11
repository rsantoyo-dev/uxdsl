import React, { useState } from 'react';
import './DemoButtons.uxdsl';

export default function DemoButtons() {
  const [selected, setSelected] = useState(false);
  return (
    <section className="demo-buttons">
      <h2>Buttons Demo</h2>
      <div className="demo-buttons__controls">
        <label>
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => setSelected(e.target.checked)}
          />
          <span style={{ marginLeft: 6 }}>Selected state (aria-pressed)</span>
        </label>
      </div>
      <div className="demo-buttons__row">
        <button type="button" aria-pressed={selected} className="btn">Contained (hover me)</button>
        <button type="button" aria-pressed={selected} className="btn btn--outlined">Outlined (hover me)</button>
        <button type="button" aria-pressed={selected} className="btn btn--flat">Flat (hover me)</button>
      </div>
      <div className="demo-buttons__row">
        <button type="button" aria-pressed={selected} className="btn btn--secondary">Contained · Secondary</button>
        <button type="button" aria-pressed={selected} className="btn btn--outlined btn--secondary">Outlined · Secondary</button>
        <button type="button" aria-pressed={selected} className="btn btn--flat btn--secondary">Flat · Secondary</button>
      </div>
      <h3>SCSS in .uxdsl</h3>
      <div className="demo-buttons__row">
        <button type="button" aria-pressed={selected} className="btn btn--sass-size-1">Sass loop (size 1)</button>
        <button type="button" aria-pressed={selected} className="btn btn--sass-size-2">Sass loop (size 2)</button>
        <button type="button" aria-pressed={selected} className="btn btn--sass-size-3">Sass loop (size 3)</button>
      </div>
    </section>
  );
}
