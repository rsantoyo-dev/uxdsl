import React from 'react';
import './DemoSurfaces.uxdsl';

export default function DemoSurfaces() {
  return (
    <section className="demo-surfaces">
      <h2>Surfaces Demo</h2>

      <div className="demo-surfaces__row">
        <div className="surface surface--contained">
          <small>contained</small>
          <p>Default surface with padding, radius and shadow.</p>
        </div>
        <div className="surface surface--outlined">
          <small>outlined</small>
          <p>Transparent bg, border and radius.</p>
        </div>
        <div className="surface surface--flat">
          <small>flat</small>
          <p>Transparent bg, no border or shadow.</p>
        </div>
      </div>

      <div className="demo-surfaces__row">
        <div className="surface surface--contained surface--secondary">
          <small>contained · secondary</small>
          <p>Tone applied via @ds-surface(contained secondary).</p>
        </div>
        <div className="surface surface--outlined surface--secondary">
          <small>outlined · secondary</small>
          <p>Border/text use secondary tone.</p>
        </div>
        <div className="surface surface--flat surface--secondary">
          <small>flat · secondary</small>
          <p>Text uses secondary tone.</p>
        </div>
      </div>

      <h3>SCSS in .uxdsl</h3>
      <div className="demo-surfaces__row">
        <div className="surface surface--sass-1">
          <small>contained · tertiary · size 1</small>
          <p>SCSS: $tone + @mixin surface-size(1)</p>
        </div>
        <div className="surface surface--sass-2">
          <small>outlined · tertiary · size 2</small>
          <p>SCSS: $tone + @mixin surface-size(2)</p>
        </div>
        <div className="surface surface--sass-3">
          <small>flat · tertiary · size 3</small>
          <p>SCSS: $tone + @mixin surface-size(3)</p>
        </div>
      </div>

      <h3>Size variants</h3>
      <div className="demo-surfaces__row">
        <div className="surface surface--contained-lg">
          <small>contained · size 4</small>
          <p>@ds-surface(contained 4)</p>
        </div>
        <div className="surface surface--outlined-lg surface--secondary">
          <small>outlined · secondary · size 3</small>
          <p>@ds-surface(outlined secondary 3)</p>
        </div>
        <div className="surface surface--flat-lg surface--secondary">
          <small>flat · secondary · size 2</small>
          <p>@ds-surface(flat secondary 2)</p>
        </div>
      </div>
    </section>
  );
}
