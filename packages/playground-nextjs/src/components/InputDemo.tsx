'use client'

export default function InputDemo() {
  return (
    <div className="demo-section">
      <h3 className="demo-title">Input Variants</h3>
      <div style={{ display: 'grid', gap: '0.75rem', maxWidth: 400 }}>
        <input className="input" placeholder="Contained" />
        <input className="input input--outlined" placeholder="Outlined" />
        <input className="input input--underline" placeholder="Underline" />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input className="input input--sm" placeholder="Small" />
          <input className="input input--md" placeholder="Medium" />
          <input className="input input--lg" placeholder="Large" />
        </div>
      </div>
    </div>
  )
}

