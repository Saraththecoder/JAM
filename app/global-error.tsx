'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global application error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'sans-serif', padding: '2rem', background: '#fbfaf7', color: '#1c1a17' }}>
        <main style={{ maxWidth: '32rem', margin: '4rem auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem' }}>Something went wrong</h1>
          <p style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
            The application could not be loaded. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.25rem',
              border: '2px solid #000',
              borderRadius: '0.75rem',
              background: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
