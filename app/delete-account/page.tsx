'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface DeletionRequest {
  id: string;
  status: 'pending' | 'processed' | 'cancelled';
  reason: string | null;
  requested_at: string;
}

export default function DeleteAccountPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [request, setRequest] = useState<DeletionRequest | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setEmail(user?.email ?? null);
      if (!user) return;

      const response = await fetch('/api/account/deletion-request', { cache: 'no-store' });
      const body = (await response.json()) as {
        error?: string;
        request?: DeletionRequest | null;
      };
      if (!response.ok) throw new Error(body.error || 'Unable to check your request.');
      setRequest(body.request ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load your account details.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // The async callback owns the state updates.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const handleRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !confirm(
        'Request deletion of your JAM account? Your department HOD will review and process the request.'
      )
    ) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/account/deletion-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const body = (await response.json()) as {
        error?: string;
        requestId?: string;
        alreadyRequested?: boolean;
      };
      if (!response.ok) throw new Error(body.error || 'Unable to submit your request.');

      setSuccess(true);
      setRequest({
        id: body.requestId || 'pending',
        status: 'pending',
        reason: reason.trim() || null,
        requested_at: new Date().toISOString(),
      });
      setReason('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to submit your request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-transparent py-10 px-4 sm:px-6">
      <article className="max-w-2xl mx-auto paper-card rounded-2xl p-6 sm:p-10 space-y-6 text-sm text-zinc-700 leading-relaxed">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-neured text-black border-2 border-black rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-black text-black">Delete your JAM account</h1>
            <p className="text-xs font-mono text-zinc-500 mt-1">
              Request deletion of your account and associated data.
            </p>
          </div>
        </div>

        <section className="space-y-2">
          <h2 className="font-bold text-black">What happens next</h2>
          <p>
            Your request is sent to your department HOD. Once processed, your login, profile,
            signature, letter requests, and signed PDFs are deleted. Audit records and the minimum
            information needed for institutional accountability may be retained as described in the{' '}
            <Link href="/privacy" className="underline font-semibold text-black">
              privacy notice
            </Link>
            .
          </p>
        </section>

        {loading ? (
          <div className="flex items-center gap-2 text-xs font-bold text-black">
            <Loader2 className="w-4 h-4 animate-spin" /> Checking your account...
          </div>
        ) : !email ? (
          <section className="space-y-3 rounded-xl border-2 border-black bg-neuyellow/40 p-4">
            <h2 className="font-bold text-black">Sign in to continue</h2>
            <p>
              For your security, deletion requests must come from the account you want to delete.
            </p>
            <Link
              href="/login?next=/delete-account"
              className="paper-btn inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-bold"
            >
              Sign in
            </Link>
          </section>
        ) : request?.status === 'pending' ? (
          <section className="space-y-3 rounded-xl border-2 border-black bg-neugreen/40 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <h2 className="font-bold text-black">Deletion request pending</h2>
            </div>
            <p>
              Your request for <strong>{email}</strong> is waiting for your department HOD. You can
              contact the department office if you need it processed urgently.
            </p>
          </section>
        ) : (
          <form onSubmit={handleRequest} className="space-y-4">
            <section className="space-y-2">
              <h2 className="font-bold text-black">Request deletion for {email}</h2>
              <p>
                This action cannot be undone after your HOD processes it. If you only need a
                correction, contact your department office instead.
              </p>
            </section>

            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-black">Reason (optional)</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={1000}
                rows={3}
                className="w-full rounded-xl border-2 border-black bg-white px-3 py-2 text-sm text-black outline-none focus:shadow-[3px_3px_0px_rgba(0,0,0,1)]"
                placeholder="Tell your HOD why you are requesting deletion."
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="paper-btn inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {submitting ? 'Submitting...' : 'Request account deletion'}
            </button>
          </form>
        )}

        {success && (
          <div className="flex items-start gap-2 rounded-xl border-2 border-black bg-neugreen/40 p-3 text-xs font-bold text-black">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Your deletion request has been submitted to your department HOD.
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border-2 border-black bg-neured/40 p-3 text-xs font-bold text-black">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="border-t-2 border-black/10 pt-4 text-xs text-zinc-500">
          <p>
            Prefer email? Contact{' '}
            <a className="underline font-semibold text-black" href="mailto:admin@aits-tpt.edu.in">
              admin@aits-tpt.edu.in
            </a>{' '}
            from your registered email address.
          </p>
          <Link href="/" className="mt-3 inline-flex font-bold text-black underline">
            Return to JAM
          </Link>
        </div>
      </article>
    </main>
  );
}
