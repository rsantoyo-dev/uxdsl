'use client'

import { Edit } from 'lucide-react'
import { useTypographyDemo, initialTypographyItems } from './TypographyDemoContext'

export default function DemoTypography() {
  const { textMap, setEditingTag } = useTypographyDemo()

  return (
    <section id="DemoTypography" className="typo-section demo-section">
      <div className="typo-header">
        <p className="demo-subtitle">
          Responsive typography scale. Click any card to edit its properties.
        </p>
      </div>

      <div className="typo-stack">
        {initialTypographyItems.map((item) => (
          <article 
            key={item.label} 
            className="typo-row"
          >
            <div className="typo-row__meta">
              <span className="typo-row__label">{item.label}</span>
              <button 
                className="typo-row__edit" 
                onClick={() => setEditingTag(item.tag)}
                aria-label="Edit"
              >
                <Edit size={14} />
              </button>
            </div>
            
            <div className="typo-row__content">
              <div className={item.className}>
                {textMap[item.tag] || item.text}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}