import Link from 'next/link'
 
export default function NotFound() {
  return (
    <div style={{ padding: '4rem', textAlign: 'center' }}>
      <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Not Found</h2>
      <p style={{ marginBottom: '2rem' }}>Could not find requested resource</p>
      <Link 
        href="/"
        style={{
          color: 'var(--ds__palette__primary-main, blue)',
          textDecoration: 'underline'
        }}
      >
        Return Home
      </Link>
    </div>
  )
}
