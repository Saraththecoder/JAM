'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import StatusBadge from '@/components/StatusBadge';
import Logo from '@/components/Logo';
import Navbar from '@/components/Navbar';
import { 
  FileText, ArrowLeft, Check, X, RefreshCw, AlertCircle, 
  Calendar, User, HelpCircle, Eye, ShieldCheck 
} from 'lucide-react';

interface Letter {
  id: string;
  created_at: string;
  generated_body: string;
  status: 'pending' | 'approved' | 'rejected' | 'pending_mentor' | 'pending_hod';
  rejection_reason: string | null;
  mentor_id: string;
  hod_id: string;
  mentor_signed_at: string | null;
  hod_signed_at: string | null;
  letter_types: {
    name: string;
  };
  student: {
    full_name: string;
    roll_number: string;
    departments: {
      name: string;
    };
  };
  mentor?: {
    full_name: string;
    designation: string;
  };
  hod?: {
    full_name: string;
    designation: string;
  };
}

export default function FacultyReviewPage() {
  const router = useRouter();
  const params = useParams();
  const letterId = params.id as string;

  const [letter, setLetter] = useState<Letter | null>(null);
  const [profile, setProfile] = useState<{ id: string; full_name: string; designation: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departmentHod, setDepartmentHod] = useState<{ id: string; full_name: string } | null>(null);
  
  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const supabase = createClient();

  const fetchLetter = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

      // Fetch the letter details with mentor and HOD nodes
      const { data, error: fetchError } = await supabase
        .from('letters')
        .select(`
          id,
          created_at,
          generated_body,
          status,
          rejection_reason,
          letter_types (name),
          student:student_id (full_name, roll_number, department_id, departments (name)),
          mentor_id,
          hod_id,
          mentor_signed_at,
          hod_signed_at,
          mentor:mentor_id (full_name, designation),
          hod:hod_id (full_name, designation)
        `)
        .eq('id', letterId)
        .single();

      if (fetchError || !data) {
        throw new Error(fetchError?.message || 'Letter not found or access denied.');
      }

      // Fetch active faculty profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, designation')
        .eq('id', user.id)
        .single();
      
      setProfile(profileData as any);
      setLetter(data as any);

      // Fetch approved HOD in student's department if HOD is not assigned yet
      if ((data.student as any)?.department_id) {
        const { data: hodData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('role', 'faculty')
          .eq('department_id', (data.student as any).department_id)
          .eq('is_approved', true)
          .or('designation.ilike.%hod%,designation.ilike.%head%')
          .limit(1);

        if (hodData && hodData.length > 0) {
          setDepartmentHod(hodData[0]);
        }
      }
    } catch (err: any) {
      console.error('Error fetching letter details:', err);
      setError(err?.message || 'Could not load letter details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (letterId) {
      fetchLetter();
    }
  }, [letterId, router, supabase]);

  const handleApprove = async () => {
    if (!letter || !profile) return;
    setActionLoading(true);
    setError(null);

    try {
      if (letter.status === 'pending_mentor' && letter.mentor_id === profile.id) {
        // Mentor approves directly: triggers PDF compile & sign API route
        const res = await fetch('/api/approve-letter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ letterId }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to approve letter.');
        }

        router.push('/faculty/dashboard');
        router.refresh();
      } else if (letter.status === 'pending_hod' && letter.hod_id === profile.id) {
        // HOD approves: triggers PDF compile & sign API route
        const res = await fetch('/api/approve-letter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ letterId }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to approve letter.');
        }

        router.push('/faculty/dashboard');
        router.refresh();
      } else {
        throw new Error('You do not have active review permission for this approval step.');
      }
    } catch (err: any) {
      console.error('Error approving letter:', err);
      setError(err?.message || 'Error occurred during approval processing.');
      setActionLoading(false);
    }
  };

  const handleForwardToHod = async () => {
    if (!letter || !profile || !departmentHod) {
      setError('Cannot forward: HOD is not registered or approved for this department.');
      return;
    }
    setActionLoading(true);
    setError(null);

    try {
      // Update letter record: status = pending_hod, hod_id = department HOD, update recipient to HOD
      const { error: updateError } = await supabase
        .from('letters')
        .update({
          status: 'pending_hod',
          hod_id: departmentHod.id,
          faculty_id: departmentHod.id,
          mentor_signed_at: new Date().toISOString(),
        })
        .eq('id', letter.id);

      if (updateError) throw updateError;

      // Trigger notification email to HOD (asynchronous)
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          letterId: letter.id,
          type: 'mentor_approved',
        }),
      }).catch((e) => console.error('Failed to trigger HOD email:', e));

      router.push('/faculty/dashboard');
      router.refresh();
    } catch (err: any) {
      console.error('Error forwarding letter:', err);
      setError(err?.message || 'Error occurred during forwarding.');
      setActionLoading(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }

    setActionLoading(true);
    setShowRejectModal(false);
    setError(null);

    try {
      // 1. Update DB status to rejected, record who declined it
      const { error: updateError } = await supabase
        .from('letters')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason.trim(),
          rejection_by: profile?.id,
        })
        .eq('id', letterId);

      if (updateError) {
        throw new Error(`Failed to reject request: ${updateError.message}`);
      }

      // 2. Trigger notification email to student (asynchronous)
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          letterId,
          type: 'rejection',
          rejectionReason: rejectionReason.trim(),
        }),
      }).catch((e) => console.error('Failed to trigger rejection email:', e));

      // 3. Return to dashboard
      router.push('/faculty/dashboard');
      router.refresh();
    } catch (err: any) {
      console.error('Error rejecting letter:', err);
      setError(err?.message || 'Failed to reject letter.');
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-zinc-500 bg-grid-pattern">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm">Fetching request details...</p>
      </div>
    );
  }

  if (error && !letter) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-grid-pattern">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-2xl text-center shadow-md">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Error Loading Request</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{error}</p>
          <Link
            href="/faculty/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 rounded-xl text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-[#1c1a17] flex flex-col pb-16">
      <Navbar
        role="review"
        profile={profile}
        backHref="/faculty/dashboard"
        backText="Back"
        statusBadge={letter && <StatusBadge status={letter.status} />}
      />

      {/* Main Review Section */}
      <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 mt-6 sm:mt-8 flex-grow grid md:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left Column: Letter preview */}
        <div className="paper-card md:col-span-8 rounded-2xl p-5 sm:p-8 md:p-10 relative max-w-full overflow-hidden bg-white">
          {actionLoading && (
            <div className="absolute inset-0 bg-[#fbfaf7]/90 dark:bg-[#151413]/95 z-20 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-black" />
              <h3 className="font-serif font-bold text-lg">Compiling Signed PDF</h3>
              <p className="text-xs text-zinc-550 font-bold">Stamping your signature, writing metadata, and uploading to Storage...</p>
            </div>
          )}

          {/* Letterhead box */}
          <div className="border-2 border-dashed border-black bg-zinc-50 p-5 rounded-xl text-center mb-8">
            <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-550 block mb-1">
              CAMPUS COLLEGE LETTERHEAD PLACEHOLDER
            </span>
            <span className="text-xs text-zinc-500 font-bold block">
              100px height reserved area - final PDF overlays college details here.
            </span>
          </div>

          <div className="space-y-6 text-xs font-serif text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
            <p className="text-right font-mono font-bold">
              Date: {new Date(letter?.created_at || '').toLocaleDateString('en-IN')}
            </p>

            <div className="space-y-0.5">
              <p className="font-bold">To,</p>
              <p className="font-semibold">The Head of the Department / Faculty In-Charge,</p>
              <p>Department of {letter?.student.departments.name},</p>
              <p>AITS, Tirupati.</p>
            </div>

            <div className="space-y-0.5">
              <p className="font-bold">From,</p>
              <p className="font-semibold">{letter?.student?.full_name || 'Deleted Student'},</p>
              <p className="font-mono font-bold">Roll Number: {letter?.student?.roll_number || 'N/A'},</p>
              <p>Department of {letter?.student?.departments?.name || 'AI&ML'}, AITS.</p>
            </div>

            <p className="font-bold text-black border-y-2 border-black py-2.5">
              Subject: Request for {letter?.letter_types?.name || 'Academic Letter'} - Reg.
            </p>

            <p>
              Respected Sir/Madam,
            </p>

            {/* Letter content */}
            <div className="whitespace-pre-line text-[13px] leading-relaxed text-black border-l-2 border-black pl-4 py-1 italic font-medium">
              {letter?.generated_body}
            </div>

            <div className="flex justify-between items-end pt-8 gap-4">
              <div>
                <p className="font-bold">Yours obediently,</p>
                <p className="font-semibold text-black mt-4">{letter?.student?.full_name || 'Deleted Student'}</p>
                <p className="font-bold">({letter?.student?.roll_number || 'N/A'})</p>
              </div>

              {/* Side-by-side signatures representation */}
              <div className="flex gap-4">
                {/* Mentor Signature */}
                <div className="text-right flex flex-col items-end">
                  <span className="text-[9px] font-sans font-bold px-1.5 py-0.5 bg-neublue text-black rounded border-2 border-black mb-1 shadow-[1px_1px_0px_rgba(0,0,0,1)]">
                    Mentor Rec.
                  </span>
                  <div className="w-24 h-10 border-2 border-dashed border-black rounded-lg flex items-center justify-center bg-zinc-50 text-[9px] text-zinc-400 font-bold">
                    {letter?.mentor_signed_at ? (
                      <span className="text-emerald-600 font-extrabold flex items-center gap-0.5 font-sans">
                        <Check className="w-3.5 h-3.5" /> Recommended
                      </span>
                    ) : (
                      'Awaiting'
                    )}
                  </div>
                  <p className="text-[9px] font-bold text-zinc-700 mt-1">{letter?.mentor?.full_name}</p>
                </div>

                {/* HOD Signature */}
                <div className="text-right flex flex-col items-end">
                  <span className="text-[9px] font-sans font-bold px-1.5 py-0.5 bg-neuyellow text-black rounded border-2 border-black mb-1 shadow-[1px_1px_0px_rgba(0,0,0,1)]">
                    HOD Approval
                  </span>
                  <div className="w-24 h-10 border-2 border-dashed border-black rounded-lg flex items-center justify-center bg-zinc-50 text-[9px] text-zinc-400 font-bold">
                    {letter?.status === 'approved' || letter?.hod_signed_at ? (
                      <span className="text-emerald-600 font-extrabold flex items-center gap-0.5 font-sans">
                        <Check className="w-3.5 h-3.5" /> Approved
                      </span>
                    ) : (
                      'Awaiting'
                    )}
                  </div>
                  <p className="text-[9px] font-bold text-zinc-700 mt-1">{letter?.hod?.full_name}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Review Action Cards */}
        <div className="md:col-span-4 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-neured border-2 border-black text-black flex items-start gap-3 text-xs font-semibold shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {(() => {
            const isMentor = letter?.mentor_id === profile?.id;
            const isHod = letter?.hod_id === profile?.id;
            const isPendingForMe = 
              (letter?.status === 'pending_mentor' && isMentor) ||
              (letter?.status === 'pending_hod' && isHod);

            if (isPendingForMe) {
              const isPendingMentorStep = letter?.status === 'pending_mentor';

              return (
                <div className="paper-card rounded-2xl p-6">
                  <h3 className="font-serif font-bold text-zinc-900 dark:text-white mb-2 flex items-center gap-2 text-base">
                    <Eye className="w-5 h-5 text-black" /> Review Queue Action
                  </h3>
                  <p className="text-xs text-zinc-655 dark:text-zinc-405 mb-6 leading-normal font-semibold">
                    You have active signing rights. Verify the letter body and select the appropriate approval path.
                  </p>

                  <div className="space-y-3">
                    {isPendingMentorStep ? (
                      <>
                        <button
                          onClick={handleApprove}
                          disabled={actionLoading}
                          className="w-full paper-btn flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-xs font-bold disabled:opacity-55 bg-neugreen! text-black cursor-pointer"
                        >
                          Approve & Sign Directly
                        </button>
                        <button
                          onClick={handleForwardToHod}
                          disabled={actionLoading || !departmentHod}
                          className="w-full paper-btn flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-xs font-bold disabled:opacity-55 bg-neuyellow! text-black cursor-pointer"
                        >
                          Forward to HOD
                        </button>
                        {!departmentHod && (
                          <p className="text-[10px] text-zinc-650 font-bold leading-snug">
                            ⚠️ HOD account is not registered/approved in your department. Forwarding is disabled.
                          </p>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={handleApprove}
                        disabled={actionLoading}
                        className="w-full paper-btn flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-xs font-bold disabled:opacity-55 bg-neugreen! text-black cursor-pointer"
                      >
                        Approve & Sign PDF
                      </button>
                    )}
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={actionLoading}
                      className="w-full paper-btn flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-xs font-bold disabled:opacity-55 bg-neured! text-black cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5 text-black" /> Decline Request
                    </button>
                  </div>
                </div>
              );
            }

            // Read only states
            return (
              <div className="paper-card rounded-2xl p-6">
                <h3 className="font-serif font-bold text-zinc-900 dark:text-white mb-3">Review Queue Status</h3>
                
                {letter?.status === 'pending_mentor' && (
                  <p className="text-xs text-zinc-650 dark:text-zinc-405 leading-normal font-semibold">
                    This letter is currently in the queue for **Class Mentor recommendation** ({letter?.mentor?.full_name}).
                  </p>
                )}

                {letter?.status === 'pending_hod' && (
                  <p className="text-xs text-zinc-655 dark:text-zinc-405 leading-normal font-semibold">
                    Class Mentor recommended. Currently in queue for **HOD final approval** ({letter?.hod?.full_name}).
                  </p>
                )}

                {letter?.status === 'rejected' && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500 font-bold">This request has been declined.</p>
                    <div className="p-3 bg-neured border-2 border-black rounded-xl text-xs text-black font-bold shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                      <span className="font-extrabold text-black block mb-1">Feedback Reason:</span>
                      <span className="text-black italic">"{letter.rejection_reason}"</span>
                    </div>
                  </div>
                )}

                {letter?.status === 'approved' && (
                  <div className="p-3 bg-neugreen border-2 border-black rounded-xl text-xs text-black font-bold flex items-center gap-1.5 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                    <ShieldCheck className="w-4.5 h-4.5 text-black" /> PDF Approved, Signed & Archived
                  </div>
                )}
              </div>
            );
          })()}

          {/* Student Profile Card */}
          <div className="paper-card rounded-2xl p-5 text-sm space-y-4">
            <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <User className="w-4 h-4 text-black" /> Student Profile
            </h4>
            <div className="space-y-2 text-xs font-bold text-black">
              <div className="flex justify-between">
                <span className="text-zinc-500">Name:</span>
                <span className="font-extrabold text-zinc-800">{letter?.student?.full_name || 'Deleted Student'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Roll No:</span>
                <span className="font-mono text-zinc-800">{letter?.student?.roll_number || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Branch:</span>
                <span className="font-extrabold text-zinc-800">{letter?.student?.departments?.name || 'AI&ML'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Decline Reason Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white border-2 border-black max-w-md w-full p-6 rounded-2xl shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-black">Decline Request</h3>
              <p className="text-xs text-zinc-600 mt-0.5 font-semibold">
                Please state the reason for rejecting this letter request. The student will receive this feedback in their email.
              </p>
            </div>
            
            <form onSubmit={handleReject} className="space-y-4">
              <textarea
                rows={4}
                required
                placeholder="e.g. Please correct the leave dates. You have chosen a Sunday."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2.5 bg-white text-black placeholder-zinc-400 border-2 border-black rounded-xl text-sm font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all"
              />

              <div className="flex justify-end gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 border-2 border-black hover:bg-zinc-150 rounded-xl font-bold bg-white text-black shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 paper-btn bg-neured! text-black rounded-xl font-bold"
                >
                  Confirm Decline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
