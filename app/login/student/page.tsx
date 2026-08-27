'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Logo from '@/components/Logo';
import { Mail, Lock, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';

export default function StudentLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw new Error(authError.message);

      if (data?.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles').select('role').eq('id', data.user.id).single();
        if (profileError) throw new Error('Could not retrieve user profile.');
        if (profile.role !== 'student') {
          await supabase.auth.signOut();
          throw new Error('Access denied. This portal is for students only. Faculty must use the Faculty Portal.');
        }
        router.push('/student/dashboard');
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in. Please verify your credentials.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-[#1c1a17] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      {/* Skip link */}
      <a href="#login-form" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-black focus:text-white focus:rounded-lg focus:text-sm focus:font-bold">
        Skip to login form
      </a>

      <div className="w-full max-w-sm mx-auto z-10">
        <div className="flex justify-center mb-5">
          <Link href="/login" className="flex items-center gap-2.5" aria-label="Back to portal selection">
            <Logo size="sm" />
            <span className="font-serif font-bold text-xl tracking-tight text-black">JAM</span>
          </Link>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-serif font-black tracking-tight text-black">Student Sign In</h1>
          <p className="mt-1.5 text-xs font-bold text-zinc-500">
            Use your university-issued student email and password.
          </p>
        </div>

        <div className="paper-card py-7 px-5 sm:px-8 rounded-2xl">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-neured border-2 border-black text-black flex items-start gap-3 text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)] font-semibold" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div>{error}</div>
            </div>
          )}

          <form id="login-form" className="space-y-5" onSubmit={handleLogin} noValidate>
            <div>
              <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-black mb-1.5">
                Student Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-black" aria-hidden="true">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  placeholder="24AK1A33D8@aits-tpt.edu.in"
                  className="block w-full pl-9 pr-3 py-2.5 bg-white text-black placeholder-zinc-400 border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
                  aria-describedby={error ? 'login-error' : undefined}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-black mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-black" aria-hidden="true">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-3 py-2.5 bg-neured text-black placeholder-black/50 border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full paper-btn flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />Signing in...</>
              ) : (
                <>Sign In <ArrowRight className="w-4 h-4" aria-hidden="true" /></>
              )}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t-2 border-black text-center text-xs text-zinc-500 font-semibold">
            <p>
              Not a student?{' '}
              <Link href="/login/faculty" className="font-bold underline text-black hover:text-neured transition-colors">
                Go to Faculty Login →
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-500 font-bold mt-4">
          Accounts are provisioned by your department HOD.
        </p>
      </div>
    </div>
  );
}
