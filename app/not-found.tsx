import Link from 'next/link';
import { FileText } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-grid-pattern">
      <div className="paper-card max-w-md w-full p-8 rounded-2xl text-center space-y-4">
        <FileText className="w-12 h-12 mx-auto text-black" />
        <h1 className="text-xl font-serif font-black text-black">Page not found</h1>
        <p className="text-xs font-semibold text-zinc-600">
          The page you are looking for does not exist or you do not have access to it.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-bold border-2 border-black bg-neuyellow text-black shadow-[2px_2px_0px_rgba(0,0,0,1)]"
        >
          Return home
        </Link>
      </div>
    </div>
  );
}
