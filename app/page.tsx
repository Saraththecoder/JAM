import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Zap, GraduationCap, ArrowRight } from 'lucide-react';
import Logo from '@/components/Logo';
import HeroCards from '@/components/HeroCards';
import SplashScreen from '@/components/SplashScreen';

export const metadata: Metadata = {
  title: 'JAM — Campus Letter Automation',
  description: 'No paper routing. Draft leave, permission, and booking requests instantly. Faculty approve and sign with a single click.',
};

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-transparent text-[#1c1a17] flex flex-col justify-between overflow-hidden">
      <SplashScreen />
      {/* Header */}
      <header className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 flex items-center justify-between border-b-2 border-black z-50">
        <div className="flex items-center gap-2">
          <Logo size="sm" />
          <div>
            <span className="font-serif font-extrabold text-base sm:text-xl tracking-tight text-black">JAM</span>
            <span className="hidden sm:inline-block ml-2 px-1.5 py-0.5 text-[9px] font-mono font-bold bg-neuyellow text-black rounded border-2 border-black shadow-[1px_1px_0px_rgba(0,0,0,1)]">
              JUST A MINUTE
            </span>
          </div>
        </div>
        <nav className="flex items-center gap-1.5 sm:gap-4" aria-label="Header navigation">
          <Link
            href="/login"
            className="hidden min-[360px]:inline-block px-3 py-1.5 text-xs font-bold text-black border-2 border-black rounded-xl hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[3px_3px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none bg-transparent transition-all"
          >
            Sign In
          </Link>
          <Link href="/login" className="paper-btn px-2.5 sm:px-4 py-2 text-xs font-bold rounded-xl">
            Get Started
          </Link>
        </nav>
      </header>      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-16 md:py-20 z-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center">
          {/* Left Column */}
          <div className="col-span-1 md:col-span-7 flex flex-col space-y-5 sm:space-y-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold border-2 border-black bg-neublue text-black rounded-lg w-fit shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              <Zap className="w-3.5 h-3.5" aria-hidden="true" />
              Department Letter Automation
            </div>

            <h1 className="text-2xl min-[360px]:text-3xl sm:text-4xl md:text-5xl font-sans font-extrabold tracking-tight leading-[1.1] text-zinc-900">
              Instant Letters. <br />
              <span className="bg-black text-neuyellow px-2 py-0.5 inline-block border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,0.15)] rounded-lg mt-1 min-[360px]:mt-0">
                Digital Approval.
              </span>
            </h1>

            <p className="text-zinc-650 text-xs sm:text-base md:text-lg font-medium leading-relaxed max-w-xl">
              No paper routing. No long waits outside HOD cabins. Draft leave, permission, and booking requests instantly. Faculty approve and sign with a single click.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-2">
              <div className="flex-1 p-5 sm:p-6 paper-card paper-card-hover rounded-2xl">
                <div className="p-2.5 bg-neublue text-black rounded-xl border-2 border-black w-fit mb-3 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                  <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
                </div>
                <h2 className="font-bold text-base sm:text-lg mb-1.5">Student Portal</h2>
                <p className="text-xs text-zinc-550 mb-4 leading-relaxed font-medium">
                  Request leave, outing passes, permission letters, and event conduct letters with AI assistance.
                </p>
                <Link
                  href="/login/student"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-black rounded-xl bg-neuyellow text-black text-xs font-bold shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all"
                >
                  Student Sign In <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </div>

              <div className="flex-1 p-5 sm:p-6 paper-card paper-card-hover rounded-2xl">
                <div className="p-2.5 bg-neugreen text-black rounded-xl border-2 border-black w-fit mb-3 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                  <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
                </div>
                <h2 className="font-bold text-base sm:text-lg mb-1.5">Faculty Portal</h2>
                <p className="text-xs text-zinc-550 mb-4 leading-relaxed font-medium">
                  Review student letters, stamp with your digital signature, and forward to HOD if required.
                </p>
                <Link
                  href="/login/faculty"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-black rounded-xl bg-neuyellow text-black text-xs font-bold shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all"
                >
                  Faculty Sign In <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>

          {/* Right Column: Preview Cards Deck */}
          <div className="col-span-1 md:col-span-5 w-full flex justify-center mt-6 md:mt-0 px-2">
            <HeroCards />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-5 border-t-2 border-black text-center text-xs text-zinc-500 flex flex-col sm:flex-row justify-between gap-3 font-mono font-bold">
        <p>© 2026 JAM (Just A Minute) • AI&amp;ML Dept, AITS Tirupati.</p>
        <div className="flex justify-center gap-4 sm:gap-6">
          <Link href="/login" className="hover:underline">Portal Access</Link>
          <span className="text-black">•</span>
          <Link href="/verify/example" className="hover:underline">Verify Letter</Link>
        </div>
      </footer>
    </div>
  );
}
