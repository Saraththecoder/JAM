'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import StatusBadge from '@/components/StatusBadge';
import Logo from '@/components/Logo';
import Navbar from '@/components/Navbar';
import { 
  FileText, LogOut, Plus, FileDown, Search, Filter, 
  Calendar, RefreshCw, AlertCircle, Clock, CheckCircle2, XCircle, User
} from 'lucide-react';

interface Letter {
  id: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'pending_mentor' | 'pending_hod';
  rejection_reason: string | null;
  generated_body: string;
  letter_types: {
    name: string;
  };
  mentor?: {
    full_name: string;
  };
  hod?: {
    full_name: string;
  };
  rejection_reviewer?: {
    full_name: string;
    role: string;
  };
}

interface StudentProfile {
  full_name: string;
  roll_number: string;
  departments: {
    name: string;
  };
}

export default function StudentDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const supabase = createClient();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, roll_number, departments(name)')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData as any);

      const { data: lettersData, error: lettersError } = await supabase
        .from('letters')
        .select(`
          id,
          created_at,
          status,
          rejection_reason,
          generated_body,
          letter_types (name),
          mentor:mentor_id (full_name),
          hod:hod_id (full_name),
          rejection_reviewer:rejection_by (full_name, role)
        `)
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });

      if (lettersError) throw lettersError;
      setLetters(lettersData as any);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err?.message || 'Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleDownload = async (letterId: string) => {
    setDownloadingId(letterId);
    try {
      const res = await fetch(`/api/download-letter/${letterId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to retrieve signed download URL');
      if (data.signedUrl) window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      alert(err.message || 'Error downloading file. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const stats = {
    total: letters.length,
    pending: letters.filter(l => l.status === 'pending_mentor' || l.status === 'pending_hod').length,
    approved: letters.filter(l => l.status === 'approved').length,
    rejected: letters.filter(l => l.status === 'rejected').length,
  };

  const filteredLetters = letters.filter(letter => {
    const matchesSearch = 
      letter.letter_types.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (letter.mentor?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (letter.hod?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || letter.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-transparent text-[#1c1a17] flex flex-col">
      {/* Skip to content */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-black focus:text-white focus:rounded-lg focus:text-sm focus:font-bold">
        Skip to content
      </a>

      <Navbar
        role="student"
        profile={profile}
        onLogout={handleLogout}
      />

      {/* Main */}
      <main id="main-content" className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Welcome */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-[#1c1a17]">
              Welcome back, {profile?.full_name ? profile.full_name.split(' ')[0] : 'Student'}!
            </h1>
            <p className="text-xs font-mono text-zinc-500 mt-0.5 font-bold">
              {profile?.departments?.name || 'AI&ML'} • {profile?.roll_number}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6" role="region" aria-label="Letter statistics">
          {[
            { label: 'Total Letters', value: stats.total, bg: 'bg-neuyellow', icon: <FileText className="w-5 h-5" /> },
            { label: 'Pending', value: stats.pending, bg: 'bg-neublue', icon: <Clock className="w-5 h-5 animate-pulse" /> },
            { label: 'Approved', value: stats.approved, bg: 'bg-neugreen', icon: <CheckCircle2 className="w-5 h-5" /> },
            { label: 'Rejected', value: stats.rejected, bg: 'bg-neured', icon: <XCircle className="w-5 h-5" /> },
          ].map(({ label, value, bg, icon }) => (
            <div key={label} className={`paper-card ${bg} text-black p-4 sm:p-5 rounded-2xl flex items-center gap-3`}>
              <div className="p-2 sm:p-2.5 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] shrink-0">
                {icon}
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] text-black/70 font-extrabold uppercase tracking-wider truncate">{label}</p>
                <p className="text-lg sm:text-xl font-extrabold font-mono text-black">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filter Controls */}
        <div className="paper-card bg-neured p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center mb-5" role="search" aria-label="Filter letters">
          <div className="relative w-full sm:w-72">
            <Search className="absolute inset-y-0 left-3 my-auto h-4 w-4 text-black pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search by type or faculty..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-xs bg-neugreen text-black placeholder-black/60 border-2 border-black rounded-xl font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all"
              aria-label="Search letters"
            />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Filter className="h-4 w-4 text-black shrink-0" aria-hidden="true" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 sm:flex-none sm:w-40 px-3 py-2.5 text-xs bg-neuyellow text-black border-2 border-black rounded-xl font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all"
              aria-label="Filter by status"
            >
              <option value="all">All Statuses</option>
              <option value="pending_mentor">Pending Mentor</option>
              <option value="pending_hod">Pending HOD</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <button
              onClick={fetchData}
              className="p-2.5 text-black border-2 border-black hover:bg-neuyellow rounded-xl transition-colors bg-white font-bold shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none shrink-0"
              title="Refresh"
              aria-label="Refresh letter list"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Letters List */}
        {loading ? (
          <div className="paper-card py-16 flex flex-col items-center justify-center gap-3 text-zinc-500 rounded-2xl" role="status" aria-live="polite">
            <RefreshCw className="w-8 h-8 animate-spin text-black" aria-hidden="true" />
            <p className="text-xs font-bold">Loading your letter requests...</p>
          </div>
        ) : error ? (
          <div className="paper-card py-12 px-6 flex flex-col items-center justify-center text-center gap-3 rounded-2xl bg-neured/10" role="alert">
            <AlertCircle className="w-10 h-10 text-rose-500" aria-hidden="true" />
            <div>
              <h2 className="font-serif font-bold text-[#1c1a17] text-lg">Failed to Load Dashboard</h2>
              <p className="text-xs text-zinc-500 mt-1 font-semibold">{error}</p>
            </div>
            <button onClick={fetchData} className="mt-2 text-xs font-bold underline text-black inline-flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Try Reloading
            </button>
          </div>
        ) : filteredLetters.length === 0 ? (
          <div className="paper-card py-16 px-6 text-center flex flex-col items-center justify-center rounded-2xl">
            <FileText className="w-12 h-12 text-black mb-4" aria-hidden="true" />
            <h2 className="font-serif font-bold text-[#1c1a17] text-lg mb-1">No Letters Found</h2>
            <p className="text-xs text-zinc-500 font-semibold max-w-sm">
              {searchTerm || statusFilter !== 'all'
                ? "No letters match your current filters."
                : "You haven't submitted any letters yet."}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Link href="/student/new-letter" className="mt-5 paper-btn inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold">
                Create your first request
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block paper-card border-2 border-black rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y-2 divide-black text-left" aria-label="Letter requests">
                  <thead className="bg-zinc-100 text-black text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th scope="col" className="px-5 py-3 border-r-2 border-black">Letter Type</th>
                      <th scope="col" className="px-5 py-3 border-r-2 border-black">Reviewer</th>
                      <th scope="col" className="px-5 py-3 border-r-2 border-black">Date</th>
                      <th scope="col" className="px-5 py-3 border-r-2 border-black">Status</th>
                      <th scope="col" className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-sm font-semibold">
                    {filteredLetters.map((letter) => (
                      <tr key={letter.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-5 py-4 border-r-2 border-black">
                          <span className="font-extrabold text-zinc-900">{letter.letter_types.name}</span>
                        </td>
                        <td className="px-5 py-4 border-r-2 border-black">
                          <div className="text-xs space-y-0.5">
                            <p className="text-zinc-500"><span className="font-bold text-black">Mentor:</span> {letter.mentor?.full_name || '—'}</p>
                            <p className="text-zinc-500"><span className="font-bold text-black">HOD:</span> {letter.hod?.full_name || '—'}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 border-r-2 border-black">
                          <div className="flex items-center gap-1.5 text-xs text-black font-bold whitespace-nowrap">
                            <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                            {new Date(letter.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </td>
                        <td className="px-5 py-4 border-r-2 border-black">
                          <StatusBadge status={letter.status} />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <LetterAction letter={letter} downloadingId={downloadingId} onDownload={handleDownload} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card Stack */}
            <div className="md:hidden space-y-3" role="list" aria-label="Letter requests">
              {filteredLetters.map((letter) => (
                <div key={letter.id} className="paper-card p-4 rounded-2xl" role="listitem">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-extrabold text-sm text-zinc-900">{letter.letter_types.name}</p>
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-bold mt-0.5">
                        <Calendar className="w-3 h-3" aria-hidden="true" />
                        {new Date(letter.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <StatusBadge status={letter.status} />
                  </div>
                  <div className="text-xs text-zinc-500 space-y-0.5 mb-3 font-semibold">
                    <p><span className="font-bold text-black">Mentor:</span> {letter.mentor?.full_name || '—'}</p>
                    <p><span className="font-bold text-black">HOD:</span> {letter.hod?.full_name || '—'}</p>
                  </div>
                  <LetterAction letter={letter} downloadingId={downloadingId} onDownload={handleDownload} />
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function LetterAction({ letter, downloadingId, onDownload }: {
  letter: Letter;
  downloadingId: string | null;
  onDownload: (id: string) => void;
}) {
  if (letter.status === 'approved') {
    return (
      <button
        onClick={() => onDownload(letter.id)}
        disabled={downloadingId === letter.id}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-black bg-neugreen border-2 border-black rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
        aria-label={`Download PDF for ${letter.letter_types.name}`}
      >
        {downloadingId === letter.id ? (
          <><RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />Downloading...</>
        ) : (
          <><FileDown className="w-3.5 h-3.5" aria-hidden="true" />Download PDF</>
        )}
      </button>
    );
  }
  if (letter.status === 'rejected') {
    return (
      <div className="text-xs font-bold text-left">
        <span className="font-extrabold text-rose-600 block mb-0.5">
          Declined by {letter.rejection_reviewer?.full_name || 'Faculty'}:
        </span>
        <span className="text-zinc-500 italic">"{letter.rejection_reason || 'No reason provided'}"</span>
      </div>
    );
  }
  return <span className="text-xs text-zinc-500 font-bold italic">Awaiting Signature</span>;
}
