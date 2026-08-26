'use client';

import React from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function StudentRegisterDisabledPage() {
  return (
    <div className="min-h-screen bg-transparent text-[#1c1a17] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
      <div className="w-full max-w-md mx-auto z-10 text-center">
        <div className="flex justify-center mb-4">
          <Link href="/" className="flex items-center gap-2.5" aria-label="JAM Home">
            <Logo size="sm" />
            <span className="font-serif font-bold text-xl tracking-tight text-black">JAM</span>
          </Link>
        </div>
      </div>

      <div className="w-full max-w-md mx-auto mt-6 z-10">
        <div className="paper-card py-8 px-6 text-center rounded-2xl bg-neured/20">
          <ShieldAlert className="w-16 h-16 text-black mx-auto mb-4 animate-bounce" />
          <h2 className="text-xl font-serif font-black text-black mb-2">Registration Closed</h2>
          <p className="text-xs text-black/85 mb-6 leading-relaxed font-bold">
            Public student registration is disabled to prevent unauthorized account creation. 
            All student credentials are created and managed by the **Head of the Department (HOD)**.
          </p>
          <div className="p-4 bg-white border-2 border-black rounded-xl text-xs font-bold text-left mb-6 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            <p className="font-extrabold text-black mb-1">To Get Your Credentials:</p>
            <ol className="list-decimal pl-4 space-y-1 font-semibold text-zinc-700">
              <li>Contact your HOD or branch administrator.</li>
              <li>Provide your official roll number and name.</li>
              <li>Sign in using the login credentials assigned to you.</li>
            </ol>
          </div>
          <Link
            href="/login/student"
            className="w-full paper-btn flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-black"
          >
            <ArrowLeft className="w-4 h-4" /> Go to Student Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
