'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2 style={{ marginBottom: '1rem' }}>Something went wrong!</h2>
      <p style={{ color: 'var(--ds__palette__error-main, red)', marginBottom: '1rem' }}>
        {error.message || 'An unexpected error occurred'}
      </p>
      <button
        onClick={() => reset()}
        style={{
          padding: '0.5rem 1rem',
          background: 'var(--ds__palette__primary-main, #333)',
          color: 'var(--ds__palette__primary-contrast, #fff)',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  )
}
