'use client'

import { useMemo, useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

const tones = ['primary', 'secondary', 'tertiary', 'success', 'info'] as const

const source = `#DemoProductivity {
  .stress-grid {
    display: grid;
    grid-template-columns: xs(1fr) md(repeat(auto-fill, minmax(120px, 1fr)));
    gap: density(2);
    padding: density(3) 0;
  }

  .stress-card {
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: density(1);
    text-align: center;
    min-width: 0;
    padding: density(2);
    border-radius: radius(2);
    box-shadow: shadow(1);
  }

  .stress-card-title { @ds-typo(body); font-weight: 700; }
  .stress-card-badge {
    @ds-surface(contained surface);
    @ds-typo(caption);
    padding: density(1);
    border-radius: radius(pill);
  }

  $tones: primary, secondary, tertiary, success, info;
  @each $tone in $tones {
    .stress-tone-#{$tone} { @ds-surface(contained #{$tone}); }
  }
}`

export default function DemoProductivity() {
  const [count, setCount] = useState(1000)
  const cards = useMemo(() => Array.from({ length: count }, (_, i) => i), [count])

  return (
    <section id="DemoProductivity" className="demo-section">
      <div className="demo-header">
        <h2 className="demo-title">One stylesheet, many cards</h2>
        <p className="demo-subtitle">
          The CSS below comes from this playground&apos;s .uxdsl source. Changing the card count changes the DOM;
          the five semantic tone rules and shared token references stay the same. This is a CSS reuse example, not a rendering benchmark.
        </p>
      </div>

      <div className="productivity-controls">
        <label className="productivity-controls__label">
          <span>Card count: <strong>{count}</strong></span>
          <input type="range" min="100" max="5000" step="100" value={count}
            onChange={e => setCount(Number(e.target.value))} className="productivity-controls__range" />
        </label>
      </div>

      <div className="demo-code-stack">
        <div className="demo-code-block-wrapper">
          <h3 className="demo-subtitle">DemoProductivity.uxdsl (source excerpt)</h3>
          <div className="demo-code-block"><SyntaxHighlighter language="scss" style={vscDarkPlus}>{source}</SyntaxHighlighter></div>
        </div>
        <div className="demo-code-block-wrapper">
          <h3 className="demo-subtitle">Component usage</h3>
          <div className="demo-code-block"><SyntaxHighlighter language="tsx" style={vscDarkPlus}>{`<div className="stress-grid">
  {cards.map((i) => (
    <div key={i} className={\`stress-card stress-tone-\${tones[i % tones.length]}\`}>
      <span className="stress-card-title">Item {i + 1}</span>
      <span className="stress-card-badge">#{i % tones.length}</span>
    </div>
  ))}
</div>`}</SyntaxHighlighter></div>
        </div>
      </div>

      <div className="demo-preview-full">
        <h3 className="demo-subtitle">Live render ({count} cards)</h3>
        <div className="stress-grid">
          {cards.map(i => (
            <div key={i} className={`stress-card stress-tone-${tones[i % tones.length]}`}>
              <span className="stress-card-title">Item {i + 1}</span>
              <span className="stress-card-badge">#{i % tones.length}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
