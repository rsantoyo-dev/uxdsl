'use client'


import styles from './DemoProductivity.module.css'
import { scopedClasses } from '../lib/uxdsl-module-classes'
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
    <section id="DemoProductivity" className={scopedClasses('module-root', styles) + ' ' + scopedClasses("demo-section", styles)}>
      <div className={scopedClasses("demo-header", styles)}>
        <h2 className={scopedClasses("demo-title", styles)}>One stylesheet, many cards</h2>
        <p className={scopedClasses("demo-subtitle", styles)}>
          The CSS below comes from this playground&apos;s .uxdsl source. Changing the card count changes the DOM;
          the five semantic tone rules and shared token references stay the same. This is a CSS reuse example, not a rendering benchmark.
        </p>
      </div>

      <div className={scopedClasses("productivity-controls", styles)}>
        <label className={scopedClasses("productivity-controls__label", styles)}>
          <span>Card count: <strong>{count}</strong></span>
          <input type="range" min="100" max="5000" step="100" value={count}
            onChange={e => setCount(Number(e.target.value))} className={scopedClasses("productivity-controls__range", styles)} />
        </label>
      </div>

      <div className={scopedClasses("demo-code-stack", styles)}>
        <div className={scopedClasses("demo-code-block-wrapper", styles)}>
          <h3 className={scopedClasses("demo-subtitle", styles)}>DemoProductivity.uxdsl (source excerpt)</h3>
          <div className={scopedClasses("demo-code-block", styles)}><SyntaxHighlighter language="scss" style={vscDarkPlus}>{source}</SyntaxHighlighter></div>
        </div>
        <div className={scopedClasses("demo-code-block-wrapper", styles)}>
          <h3 className={scopedClasses("demo-subtitle", styles)}>Component usage</h3>
          <div className={scopedClasses("demo-code-block", styles)}><SyntaxHighlighter language="tsx" style={vscDarkPlus}>{`<div className="stress-grid">
  {cards.map((i) => (
    <div key={i} className={\`stress-card stress-tone-\${tones[i % tones.length]}\`}>
      <span className="stress-card-title">Item {i + 1}</span>
      <span className="stress-card-badge">#{i % tones.length}</span>
    </div>
  ))}
</div>`}</SyntaxHighlighter></div>
        </div>
      </div>

      <div className={scopedClasses("demo-preview-full", styles)}>
        <h3 className={scopedClasses("demo-subtitle", styles)}>Live render ({count} cards)</h3>
        <div className={scopedClasses("stress-grid", styles)}>
          {cards.map(i => (
            <div key={i} className={scopedClasses(`stress-card stress-tone-${tones[i % tones.length]}`, styles)}>
              <span className={scopedClasses("stress-card-title", styles)}>Item {i + 1}</span>
              <span className={scopedClasses("stress-card-badge", styles)}>#{i % tones.length}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
