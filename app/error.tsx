'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-grid-pattern">
      <div className="paper-card max-w-md w-full p-8 rounded-2xl text-center space-y-4">
        <AlertTriangle className="w-12 h-12 mx-auto text-black" />
        <h1 className="text-xl font-serif font-black text-black">Something went wrong</h1>
        <p className="text-xs font-semibold text-zinc-600 leading-relaxed">
          The page could not be loaded. If this continues, contact your department administrator.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
          <button
            onClick={reset}
            className="paper-btn inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold"
          >
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-bold border-2 border-black bg-white text-black"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
