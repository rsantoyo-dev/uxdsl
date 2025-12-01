import Link from 'next/link'
import { Home, Book, Grid3X3, Palette } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="not-found-container">
      <h1 className="error-code">404</h1>
      
      <div className="title-group">
        <h2 className="title">Page Not Found</h2>
        <p className="subtitle">
          We couldn&apos;t find the page you were looking for. It might have been moved, deleted, or perhaps it never existed.
        </p>
      </div>

      <div className="nav-grid">
        <Link href="/" className="nav-card">
          <div className="nav-card-icon"><Home size={20} /></div>
          <div className="nav-card-title">Home</div>
          <p className="nav-card-desc">Return to the homepage and start fresh.</p>
        </Link>

        <Link href="/docs/home" className="nav-card">
          <div className="nav-card-icon"><Book size={20} /></div>
          <div className="nav-card-title">Documentation</div>
          <p className="nav-card-desc">Learn how to use UXDSL effectively.</p>
        </Link>

        <Link href="/docs/densities" className="nav-card">
          <div className="nav-card-icon"><Grid3X3 size={20} /></div>
          <div className="nav-card-title">Density System</div>
          <p className="nav-card-desc">Explore our responsive density tokens.</p>
        </Link>

        <Link href="/docs/palette" className="nav-card">
          <div className="nav-card-icon"><Palette size={20} /></div>
          <div className="nav-card-title">Color Palette</div>
          <p className="nav-card-desc">Check out the deep theming system.</p>
        </Link>
      </div>
    </div>
  )
}