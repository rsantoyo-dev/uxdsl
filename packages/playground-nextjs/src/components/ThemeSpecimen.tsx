import type { ThemePartId } from '@/lib/theme-parts'

/**
 * A small drawing of one part of the theme, made of the very tokens that part edits: it
 * changes with the theme like everything else on the page. Decoration only; whatever shows
 * it says in text what the part is. Used by the home page's invitation and by the rows of
 * the Live theme handler.
 */
export default function ThemeSpecimen({ id }: { id: ThemePartId }) {
  return (
    <span className="tsp" aria-hidden="true">
      <Drawing id={id} />
    </span>
  )
}

function Drawing({ id }: { id: ThemePartId }) {
  switch (id) {
    case 'colors':
      return (
        <>
          {(['primary', 'secondary', 'success', 'warning'] as const).map((tone) => (
            <span key={tone} className={`tsp__dot tsp__dot--${tone}`} />
          ))}
        </>
      )
    case 'breakpoints':
      return <span className="tsp__bp" />
    case 'spacing':
      return (
        <>
          <span className="tsp__box tsp__box--3" />
          <span className="tsp__box tsp__box--5" />
          <span className="tsp__box tsp__box--7" />
        </>
      )
    case 'typography':
      return <span className="tsp__type">Aa</span>
    case 'edges':
      return <span className="tsp__edge" />
    case 'shadows':
      return <span className="tsp__shadow" />
    case 'surfaces':
      return <span className="tsp__surface" />
    case 'controls':
      return <span className="tsp__button">Button</span>
    case 'json':
      return <span className="tsp__json">{'{ }'}</span>
  }
}
