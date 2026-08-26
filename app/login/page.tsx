import type { Metadata } from 'next';
import Link from 'next/link';
import { GraduationCap, ShieldCheck, ArrowRight } from 'lucide-react';
import Logo from '@/components/Logo';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Choose your portal to access the JAM letter automation platform.',
};

export default function LoginPortalPage() {
  return (
    <div className="min-h-screen bg-transparent text-[#1c1a17] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md mx-auto text-center z-10">
        <Link href="/" className="inline-flex items-center justify-center gap-2 sm:gap-3 mb-5" aria-label="Return to JAM homepage">
          <Logo size="sm" />
          <span className="font-serif font-bold text-xl tracking-tight text-black">JAM</span>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-black mb-2">
          Select Your Portal
        </h1>
        <p className="text-xs text-zinc-500 font-bold max-w-xs mx-auto mb-8">
          Choose the appropriate section below to access your dashboard.
        </p>
      </div>

      <div className="w-full max-w-2xl mx-auto z-10">
        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Student Card */}
          <div className="paper-card bg-neublue p-5 sm:p-6 flex flex-col justify-between rounded-2xl">
            <div>
              <div className="p-3 bg-white text-black rounded-xl border-2 border-black w-fit mb-4 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                <GraduationCap className="w-6 h-6" aria-hidden="true" />
              </div>
              <h2 className="font-extrabold text-lg text-black mb-1">Student Portal</h2>
              <p className="text-xs text-black/75 mb-5 leading-relaxed font-bold">
                Submit academic leaves, outing passes, permission requests, or event conduct drafts.
              </p>
            </div>
            <Link
              href="/login/student"
              className="inline-flex items-center justify-between px-4 py-2.5 bg-white border-2 border-black rounded-xl text-xs font-bold text-black shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all"
            >
              <span>Student Sign In</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          {/* Faculty Card */}
          <div className="paper-card bg-neuyellow p-5 sm:p-6 flex flex-col justify-between rounded-2xl">
            <div>
              <div className="p-3 bg-white text-black rounded-xl border-2 border-black w-fit mb-4 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                <ShieldCheck className="w-6 h-6" aria-hidden="true" />
              </div>
              <h2 className="font-extrabold text-lg text-black mb-1">Faculty Portal</h2>
              <p className="text-xs text-black/75 mb-5 leading-relaxed font-bold">
                Access your review queue to digitally stamp and sign pending student requests.
              </p>
            </div>
            <Link
              href="/login/faculty"
              className="inline-flex items-center justify-between px-4 py-2.5 bg-white border-2 border-black rounded-xl text-xs font-bold text-black shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all"
            >
              <span>Faculty Sign In</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="text-center mt-8 text-xs font-bold text-zinc-500">
          <Link href="/" className="hover:underline">← Back to Homepage</Link>
        </div>
      </div>
    </div>
  );
}
