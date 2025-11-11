import React, { useState } from 'react';
import './DemoInputs.uxdsl';

export default function DemoInputs() {
  const [disabled, setDisabled] = useState(false);
  const [invalid, setInvalid] = useState(false);
  return (
    <section className="demo-inputs">
      <h2>Inputs Demo</h2>
      <div className="demo-inputs__controls">
        <label><input type="checkbox" checked={disabled} onChange={e=>setDisabled(e.target.checked)} /> <span style={{marginLeft:6}}>Disabled</span></label>
        <label><input type="checkbox" checked={invalid} onChange={e=>setInvalid(e.target.checked)} /> <span style={{marginLeft:6}}>Invalid (aria-invalid)</span></label>
      </div>
      <div className="demo-inputs__row">
        <input className="input input--contained" placeholder="contained" disabled={disabled} aria-invalid={invalid || undefined} />
        <input className="input input--outlined" placeholder="outlined" disabled={disabled} aria-invalid={invalid || undefined} />
        <input className="input input--underline" placeholder="underline" disabled={disabled} aria-invalid={invalid || undefined} />
      </div>
      <div className="demo-inputs__row">
        <input className="input input--contained input--secondary" placeholder="contained · secondary" disabled={disabled} aria-invalid={invalid || undefined} />
        <input className="input input--outlined input--secondary" placeholder="outlined · secondary" disabled={disabled} aria-invalid={invalid || undefined} />
        <input className="input input--underline input--secondary" placeholder="underline · secondary" disabled={disabled} aria-invalid={invalid || undefined} />
      </div>
      <h3>Other types (defaults)</h3>
      <div className="demo-inputs__row">
        <input type="text" className="input input--contained" placeholder="text" disabled={disabled} aria-invalid={invalid || undefined} />
        <input type="password" className="input input--contained" placeholder="password" disabled={disabled} aria-invalid={invalid || undefined} />
        <input type="email" className="input input--contained" placeholder="email" disabled={disabled} aria-invalid={invalid || undefined} />
        <input type="number" className="input input--contained" placeholder="number" disabled={disabled} aria-invalid={invalid || undefined} />
        <input type="search" className="input input--contained" placeholder="search" disabled={disabled} aria-invalid={invalid || undefined} />
        <input type="tel" className="input input--contained" placeholder="tel" disabled={disabled} aria-invalid={invalid || undefined} />
        <textarea className="input input--contained" placeholder="textarea" rows={2} disabled={disabled} aria-invalid={invalid || undefined} />
      </div>
    </section>
  );
}
