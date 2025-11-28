export default function CardDemo() {
  return (
    <div className="demo-section">
      <div className="demo-grid demo-grid--2col">
        <div className="card">
          <h4 className="card__title">UXDSL Design System</h4>
          <p className="card__content">
            A lightweight CSS DSL that extends SCSS with design system features,
            runtime theming, and responsive utilities.
          </p>
        </div>

        <div className="card">
          <h4 className="card__title">Next.js Integration</h4>
          <p className="card__content">
            Full SSR support with PostCSS processing. No Tailwind required -
            pure design system approach with TypeScript.
          </p>
        </div>

        <div className="card">
          <h4 className="card__title">Performance Optimized</h4>
          <p className="card__content">
            Minimal CSS output, efficient PostCSS processing, and optimized
            for production builds with millions of users.
          </p>
        </div>

        <div className="card">
          <h4 className="card__title">Developer Experience</h4>
          <p className="card__content">
            TypeScript support, comprehensive tooling, and intuitive API
            that scales from small projects to enterprise applications.
          </p>
        </div>
      </div>
    </div>
  );
}