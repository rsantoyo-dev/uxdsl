/**
 * The Live theme handler's showcase: a small page — a menu, a hero, news — styled only
 * with UXDSL (ThemeShowcase.uxdsl). It has no state and no inline style: every color,
 * space, type size and layout change is the theme's, so it follows each edit in the tabs
 * below, and its layout changes at md like any component built with UXDSL.
 */
const NEWS = [
  { tag: 'Design', tone: 'secondary', title: 'A palette is a set of roles', body: 'Name what a color is for, and a theme can change which color that is without touching a component.', meta: '5 min read' },
  { tag: 'Release', tone: 'info', title: 'Dark mode without a second theme', body: 'The dark palette lives next to the light one, and a component reads the same role in both.', meta: '3 min read' },
  { tag: 'Guide', tone: 'success', title: 'Spacing that follows the screen', body: 'A Density token gives each breakpoint its step of the scale, for every component that names it.', meta: '8 min read' },
]

export default function ThemeShowcase() {
  return (
    <section className="shw" aria-label="Theme showcase">
      <header className="shw__nav">
        <span className="shw__brand">Tile</span>
        <nav className="shw__menu" aria-label="Showcase menu">
          {['Home', 'News', 'Topics', 'About'].map((item, index) => (
            <button key={item} type="button" className={`shw__link${index === 1 ? ' is-selected' : ''}`}>{item}</button>
          ))}
        </nav>
        <button type="button" className="shw__cta">Subscribe</button>
      </header>

      <div className="shw__hero">
        <span className="shw__eyebrow">Theme showcase</span>
        <h3 className="shw__title">Design news, one tile at a time</h3>
        <p className="shw__subtitle">
          A small news page drawn with tokens alone. Every color, space and type size here is a token of the theme you are
          editing.
        </p>
        <div className="shw__actions">
          <button type="button" className="shw__primary">Read the news</button>
          <button type="button" className="shw__secondary">Browse topics</button>
        </div>
      </div>

      <div className="shw__news">
        {NEWS.map((item) => (
          <article key={item.title} className="shw__card">
            <span className={`shw__tag shw__tag--${item.tone}`}>{item.tag}</span>
            <h4 className="shw__card-title">{item.title}</h4>
            <p className="shw__card-body">{item.body}</p>
            <span className="shw__meta">{item.meta}</span>
          </article>
        ))}
      </div>

      <span className="shw__bp">Layout at </span>
    </section>
  )
}
