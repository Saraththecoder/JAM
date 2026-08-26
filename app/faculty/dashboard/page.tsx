'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import StatusBadge from '@/components/StatusBadge';
import Logo from '@/components/Logo';
import Navbar from '@/components/Navbar';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { 
  FileText, LogOut, CheckCircle2, XCircle, Search, Filter, 
  Calendar, RefreshCw, AlertCircle, Clock, ChevronRight, ShieldAlert, Upload 
} from 'lucide-react';

gsap.registerPlugin();

interface Letter {
  id: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'pending_mentor' | 'pending_hod';
  rejection_reason: string | null;
  mentor_id: string;
  hod_id: string;
  letter_types: {
    name: string;
  };
  student: {
    full_name: string;
    roll_number: string;
  };
}

interface FacultyProfile {
  id: string;
  role: string;
  department_id?: string;
  full_name: string;
  designation: string;
  is_approved: boolean;
  departments: {
    name: string;
  };
}

export default function FacultyDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<FacultyProfile | null>(null);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  const supabase = createClient();

  // GSAP animation refs
  const pageRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Signature update states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newSignatureFile, setNewSignatureFile] = useState<File | null>(null);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // HOD Admin Database tab states
  const [activeTab, setActiveTab] = useState<'queue' | 'database'>('queue');
  const [deptProfiles, setDeptProfiles] = useState<any[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newRole, setNewRole] = useState<'student' | 'faculty'>('student');
  const [newName, setNewName] = useState('');
  const [newRollNumber, setNewRollNumber] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDesignation, setNewDesignation] = useState('Faculty');
  const [adminActionError, setAdminActionError] = useState<string | null>(null);
  const [adminActionSuccess, setAdminActionSuccess] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Bulk CSV Import states
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; success: number; failed: number } | null>(null);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkImporting, setBulkImporting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

      // 1. Fetch Profile info with department name
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, full_name, designation, is_approved, department_id, departments(name)')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData as any);

      // If user is not approved, we don't need to load letters
      if (!profileData.is_approved) {
        setLoading(false);
        return;
      }

      // 2. Fetch Letters addressed to this faculty member sorted by newest (either as Mentor or HOD)
      const { data: lettersData, error: lettersError } = await supabase
        .from('letters')
        .select(`
          id,
          created_at,
          status,
          rejection_reason,
          letter_types (name),
          student:student_id (full_name, roll_number),
          mentor_id,
          hod_id
        `)
        .or(`mentor_id.eq.${user.id},hod_id.eq.${user.id},faculty_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (lettersError) throw lettersError;
      setLetters(lettersData as any);
    } catch (err: any) {
      console.error('Error fetching faculty dashboard data:', err);
      setError(err?.message || 'Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [router, supabase]);

  const isHodUser = profile?.role === 'faculty' && (
    profile.designation?.toLowerCase().includes('hod') ||
    profile.designation?.toLowerCase().includes('head')
  );

  const fetchDeptProfiles = async () => {
    if (!profile) return;
    setLoadingProfiles(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('id, full_name, roll_number, designation, role, is_approved, created_at')
        .eq('department_id', (profile as any).department_id)
        .order('role', { ascending: false })
        .order('full_name', { ascending: true });
      if (fetchErr) throw fetchErr;
      setDeptProfiles(data || []);
    } catch (err: any) {
      console.error('Error fetching department profiles:', err);
    } finally {
      setLoadingProfiles(false);
    }
  };

  const handleDeleteUser = async (targetUserId: string) => {
    if (!confirm('Are you sure you want to delete this account? All associated letter requests and profile data will be permanently removed.')) {
      return;
    }
    setActionLoading(true);
    setAdminActionError(null);
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetUserId }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to delete user.');
      }
      fetchDeptProfiles();
    } catch (err: any) {
      setAdminActionError(err.message || 'Failed to delete user.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setAdminActionError(null);
    setAdminActionSuccess(false);

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: newRole,
          full_name: newName,
          roll_number: newRole === 'student' ? newRollNumber : undefined,
          email: newRole === 'faculty' ? newEmail : undefined,
          password: newPassword,
          designation: newRole === 'faculty' ? newDesignation : undefined,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to create user.');
      }

      setAdminActionSuccess(true);
      setShowAddUserModal(false);
      setNewName('');
      setNewRollNumber('');
      setNewEmail('');
      setNewPassword('');
      setNewDesignation('Faculty');
      fetchDeptProfiles();
    } catch (err: any) {
      setAdminActionError(err.message || 'Failed to add user account.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkFile) return;

    setBulkImporting(true);
    setBulkErrors([]);
    setBulkProgress({ current: 0, total: 0, success: 0, failed: 0 });

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error('Could not read CSV file.');

        // Parse CSV lines
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length <= 1) {
          throw new Error('CSV file is empty or only contains headers.');
        }

        // Header: role,name,identifier,password,designation
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
        const roleIdx = headers.indexOf('role');
        const nameIdx = headers.indexOf('name');
        const identifierIdx = headers.indexOf('identifier');
        const passwordIdx = headers.indexOf('password');
        const designationIdx = headers.indexOf('designation');

        if (roleIdx === -1 || nameIdx === -1 || identifierIdx === -1 || passwordIdx === -1) {
          throw new Error('CSV must contain headers: role, name, identifier, password (designation is optional).');
        }

        const records = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim());
          if (cols.length < 4) continue; // Skip malformed rows
          records.push({
            role: cols[roleIdx],
            name: cols[nameIdx],
            identifier: cols[identifierIdx],
            password: cols[passwordIdx],
            designation: designationIdx !== -1 ? cols[designationIdx] : undefined
          });
        }

        setBulkProgress({ current: 0, total: records.length, success: 0, failed: 0 });

        let successCount = 0;
        let failedCount = 0;
        const errorList: string[] = [];

        for (let idx = 0; idx < records.length; idx++) {
          const rec = records[idx];
          try {
            const res = await fetch('/api/admin/create-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                role: rec.role,
                full_name: rec.name,
                roll_number: rec.role === 'student' ? rec.identifier : undefined,
                email: rec.role === 'faculty' ? rec.identifier : undefined,
                password: rec.password,
                designation: rec.role === 'faculty' ? rec.designation : undefined,
              }),
            });

            const result = await res.json();
            if (!res.ok) {
              throw new Error(result.error || 'Failed to create user');
            }

            successCount++;
          } catch (err: any) {
            failedCount++;
            errorList.push(`Row ${idx + 2} (${rec.name}): ${err.message || 'Unknown error'}`);
          }

          setBulkProgress({
            current: idx + 1,
            total: records.length,
            success: successCount,
            failed: failedCount
          });
        }

        setBulkErrors(errorList);
        fetchDeptProfiles();
      } catch (err: any) {
        setBulkErrors([err.message || 'Failed to parse CSV file.']);
      } finally {
        setBulkImporting(false);
      }
    };

    reader.readAsText(bulkFile);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleSignatureUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSignatureFile || !profile) return;

    if (newSignatureFile.type !== 'image/png') {
      setUploadError('Only PNG format is supported for e-signatures.');
      return;
    }

    setUploadingSignature(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(newSignatureFile);
      reader.onloadend = async () => {
        const base64Data = reader.result as string;

        const res = await fetch('/api/upload-signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: profile.id,
            fileBase64: base64Data,
            fileType: newSignatureFile.type,
          }),
        });

        const result = await res.json();

        if (!res.ok) {
          throw new Error(result.error || 'Failed to upload new signature.');
        }

        setUploadSuccess(true);
        setUploadingSignature(false);
        setNewSignatureFile(null);
        
        // Auto close modal
        setTimeout(() => {
          setShowUploadModal(false);
          setUploadSuccess(false);
        }, 2000);
      };

      reader.onerror = () => {
        throw new Error('Failed to parse image file.');
      };
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || 'Failed to update signature.');
      setUploadingSignature(false);
    }
  };

  const isPendingForUser = (letter: Letter) => {
    if (!profile) return false;
    if (letter.status === 'pending_mentor' && letter.mentor_id === profile.id) return true;
    if (letter.status === 'pending_hod' && letter.hod_id === profile.id) return true;
    return false;
  };

  // Stats computation
  const stats = {
    pending: letters.filter(isPendingForUser).length,
    approved: letters.filter(l => l.status === 'approved').length,
    rejected: letters.filter(l => l.status === 'rejected').length,
  };

  // Filtering logic
  const filteredLetters = letters.filter(letter => {
    const matchesSearch = 
      (letter.letter_types?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (letter.student?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (letter.student?.roll_number || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = false;
    if (statusFilter === 'all') {
      matchesStatus = true;
    } else if (statusFilter === 'pending') {
      matchesStatus = isPendingForUser(letter);
    } else {
      matchesStatus = letter.status === statusFilter;
    }
    
    return matchesSearch && matchesStatus;
  });

  // GSAP page entrance — runs once after data loads
  useGSAP(() => {
    if (loading || !pageRef.current) return;

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    // Navbar slides down
    tl.fromTo(navRef.current,
      { y: -60, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.55 }
    );

    // Heading section fades up
    tl.fromTo(headingRef.current,
      { y: 28, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45 },
      '-=0.25'
    );

    // HOD tabs (if present)
    if (tabsRef.current) {
      tl.fromTo(tabsRef.current,
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35 },
        '-=0.2'
      );
    }

    // Stat cards spring in with stagger
    if (statsRef.current) {
      tl.fromTo(
        statsRef.current.querySelectorAll('.stat-card'),
        { y: 40, opacity: 0, scale: 0.92 },
        { y: 0, opacity: 1, scale: 1, duration: 0.5, stagger: 0.1, ease: 'back.out(1.4)' },
        '-=0.15'
      );
    }

    // Filter bar slides up
    if (filterRef.current) {
      tl.fromTo(filterRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4 },
        '-=0.2'
      );
    }

    // Table / content area fades up
    if (tableRef.current) {
      tl.fromTo(tableRef.current,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.45 },
        '-=0.15'
      );

      // Individual rows cascade in
      const rows = tableRef.current.querySelectorAll('tbody tr');
      if (rows.length) {
        tl.fromTo(
          rows,
          { x: -16, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.3, stagger: 0.04, ease: 'power2.out' },
          '-=0.25'
        );
      }
    }
  }, { scope: pageRef, dependencies: [loading] });

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-grid-pattern">
        {/* Animated loader */}
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl border-4 border-black bg-neuyellow shadow-[4px_4px_0px_rgba(0,0,0,1)] flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-black animate-spin" />
          </div>
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-neugreen border-2 border-black animate-bounce" />
        </div>
        <div className="text-center">
          <p className="text-sm font-black text-black">Initializing faculty panel...</p>
          <p className="text-[10px] font-mono text-zinc-500 font-bold mt-0.5">Fetching your review queue</p>
        </div>
      </div>
    );
  }

  // Account not approved screen
  if (profile && !profile.is_approved) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-start py-12 px-4">
        <div className="paper-card p-8 rounded-2xl text-center max-w-md w-full animate-pop-in">
          <div className="p-4 bg-neuyellow border-2 border-black rounded-2xl w-fit mx-auto mb-4 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            <ShieldAlert className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-xl font-serif font-bold text-black mb-2">Verification Pending</h1>
          <p className="text-xs text-zinc-500 font-semibold mb-5 leading-relaxed">
            Welcome, <strong>{profile.full_name}</strong>. Your account ({profile.designation}) is pending HOD approval.
          </p>
          <button onClick={fetchData} className="paper-btn inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold">
            <RefreshCw className="w-4 h-4" /> Refresh Status
          </button>
        </div>
      </div>
    );
  }

  return (<div ref={pageRef} className="min-h-screen bg-transparent text-[#1c1a17] flex flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-black focus:text-white focus:rounded-lg focus:text-sm focus:font-bold">Skip to content</a>
      <Navbar
        ref={navRef}
        role="faculty"
        profile={profile}
        onLogout={handleLogout}
        style={{ opacity: 0 }}
      />

      {/* Main Container */}
      <main id="main-content" className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Profile Welcome */}
        <div ref={headingRef} style={{ opacity: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-serif font-bold text-[#1c1a17] dark:text-white">
              Review Queue
            </h1>
            <p className="text-xs font-mono text-zinc-650 dark:text-zinc-400 mt-1 font-bold">
              Department of {profile?.departments?.name} • Logged in as: {profile?.full_name} ({profile?.designation})
            </p>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="paper-btn inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold"
          >
            <Upload className="w-4 h-4" /> Change Signature
          </button>
        </div>

        {/* HOD Admin Navigation Tabs */}
        {isHodUser && (
          <div ref={tabsRef} style={{ opacity: 0 }} className="flex gap-4 mb-8 border-b-2 border-black pb-3">
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-4 py-2.5 text-xs font-black rounded-xl border-2 border-black transition-all cursor-pointer ${
                activeTab === 'queue'
                  ? 'bg-neuyellow text-black shadow-[2px_2px_0px_rgba(0,0,0,1)] translate-x-[-1px] translate-y-[-1px]'
                  : 'bg-white text-black hover:bg-zinc-50 shadow-none'
              }`}
            >
              Letters Review Queue
            </button>
            <button
              onClick={() => {
                setActiveTab('database');
                fetchDeptProfiles();
              }}
              className={`px-4 py-2.5 text-xs font-black rounded-xl border-2 border-black transition-all cursor-pointer ${
                activeTab === 'database'
                  ? 'bg-neuyellow text-black shadow-[2px_2px_0px_rgba(0,0,0,1)] translate-x-[-1px] translate-y-[-1px]'
                  : 'bg-white text-black hover:bg-zinc-50 shadow-none'
              }`}
            >
              Department Database
            </button>
          </div>
        )}

        {activeTab === 'queue' ? (
          <>
            {/* Stats Grid */}
            <div ref={statsRef} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="stat-card paper-card bg-neuyellow text-black p-5 rounded-2xl flex items-center gap-4 paper-card-hover cursor-default">
                <div className="p-2.5 bg-white text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <p className="text-[10px] text-black/75 font-extrabold uppercase tracking-wider">Pending Approvals</p>
                  <p className="text-xl font-extrabold font-mono text-black">{stats.pending}</p>
                </div>
              </div>

              <div className="stat-card paper-card bg-neugreen text-black p-5 rounded-2xl flex items-center gap-4 paper-card-hover cursor-default">
                <div className="p-2.5 bg-white text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-black/75 font-extrabold uppercase tracking-wider">Signed Letters</p>
                  <p className="text-xl font-extrabold font-mono text-black">{stats.approved}</p>
                </div>
              </div>

              <div className="stat-card paper-card bg-neured text-black p-5 rounded-2xl flex items-center gap-4 paper-card-hover cursor-default">
                <div className="p-2.5 bg-white text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-black/75 font-extrabold uppercase tracking-wider">Rejected Requests</p>
                  <p className="text-xl font-extrabold font-mono text-black">{stats.rejected}</p>
                </div>
              </div>
            </div>

            {/* Filter Controls */}
            <div ref={filterRef} style={{ opacity: 0 }} className="paper-card bg-neured p-4 rounded-2xl flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
              <div className="relative w-full md:w-80 font-sans">
                <Search className="absolute inset-y-0 left-3 my-auto h-4 w-4 text-black" />
                <input
                  type="text"
                  placeholder="Search by student name or roll no..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-neugreen text-black placeholder-black/60 border-2 border-black rounded-xl font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all"
                />
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto font-sans">
                <Filter className="h-4 w-4 text-black shrink-0 font-bold" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full md:w-44 px-3 py-2.5 text-xs bg-neuyellow text-black border-2 border-black rounded-xl font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all"
                >
                  <option value="pending" className="bg-white text-black font-bold">Pending Queue</option>
                  <option value="approved" className="bg-white text-black font-bold">Approved & Signed</option>
                  <option value="rejected" className="bg-white text-black font-bold">Rejected Requests</option>
                  <option value="all" className="bg-white text-black font-bold">All Request History</option>
                </select>
                <button
                  onClick={fetchData}
                  className="p-2.5 text-black hover:text-black border-2 border-black hover:bg-neuyellow rounded-xl transition-colors bg-white font-bold shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none"
                  title="Refresh Queue"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Requests Table */}
            <div ref={tableRef} style={{ opacity: 0 }}>
            {error ? (
              <div className="paper-card py-12 px-6 flex flex-col items-center justify-center text-center gap-3 rounded-2xl bg-neured/10">
                <AlertCircle className="w-10 h-10 text-rose-500" />
                <div>
                  <h3 className="font-serif font-bold text-[#1c1a17] dark:text-white text-lg">Failed to Load Requests</h3>
                  <p className="text-xs text-zinc-650 mt-1 font-semibold">{error}</p>
                </div>
                <button
                  onClick={fetchData}
                  className="mt-2 text-xs font-bold underline text-black dark:text-white inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Try Reloading
                </button>
              </div>
            ) : filteredLetters.length === 0 ? (
              <div className="paper-card py-16 px-6 text-center flex flex-col items-center justify-center rounded-2xl">
                <FileText className="w-12 h-12 text-black mb-4" />
                <h3 className="font-serif font-bold text-[#1c1a17] dark:text-white text-lg mb-1">Queue is Empty</h3>
                <p className="text-xs text-zinc-550 dark:text-zinc-400 font-semibold max-w-sm">
                  {searchTerm 
                    ? "No student requests match your current filters." 
                    : statusFilter === 'pending'
                      ? "Great job! You have cleared your review queue. No letters pending signatures."
                      : `No requests with status "${statusFilter}" were found.`}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table view */}
                <div className="hidden md:block paper-card border-2 border-black rounded-2xl overflow-hidden bg-white">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y-2 divide-black text-left">
                      <thead className="bg-zinc-100 text-black text-xs font-bold uppercase tracking-wider border-b-2 border-black">
                        <tr>
                          <th className="px-6 py-4 border-r-2 border-black">Student</th>
                          <th className="px-6 py-4 border-r-2 border-black">Letter Type</th>
                          <th className="px-6 py-4 border-r-2 border-black">Date Submitted</th>
                          <th className="px-6 py-4 border-r-2 border-black">Status</th>
                          <th className="px-6 py-4 text-right">Review Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 text-sm font-semibold">
                        {filteredLetters.map((letter, idx) => (
                          <tr
                            key={letter.id}
                            className="hover:bg-neuyellow/10 transition-colors animate-row-in"
                            style={{ animationDelay: `${idx * 40}ms` }}
                          >
                            <td className="px-6 py-4 border-r-2 border-black whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-neublue text-black border-2 border-black flex items-center justify-center text-xs font-bold shadow-[1px_1px_0px_rgba(0,0,0,1)]">
                                  {(letter.student?.full_name || '?').charAt(0)}
                                </div>
                                <div>
                                  <p className="font-extrabold text-zinc-900 dark:text-zinc-200">
                                    {letter.student?.full_name || 'Deleted Student'}
                                  </p>
                                  <p className="text-[10px] text-zinc-550 dark:text-zinc-450 font-bold">
                                    {letter.student?.roll_number || 'N/A'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 border-r-2 border-black whitespace-nowrap font-extrabold">
                              <span className="font-bold text-zinc-900 dark:text-zinc-250">
                                {letter.letter_types.name}
                              </span>
                            </td>
                            <td className="px-6 py-4 border-r-2 border-black whitespace-nowrap text-zinc-500">
                              <div className="flex items-center gap-1.5 text-xs text-black font-bold">
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(letter.created_at).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </div>
                            </td>
                            <td className="px-6 py-4 border-r-2 border-black whitespace-nowrap">
                              <StatusBadge status={letter.status} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <Link
                                  href={`/faculty/review/${letter.id}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-black bg-neuyellow border-2 border-black rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all"
                                >
                                  {isPendingForUser(letter) ? 'Review & Sign' : 'View Details'}{' '}
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Card Stack view */}
                <div className="md:hidden space-y-4" role="list" aria-label="Student requests">
                  {filteredLetters.map((letter, idx) => (
                    <div
                      key={letter.id}
                      className="paper-card p-4 rounded-2xl bg-white space-y-3 animate-row-in"
                      style={{ animationDelay: `${idx * 40}ms` }}
                      role="listitem"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-neublue text-black border-2 border-black flex items-center justify-center text-xs font-bold shadow-[1px_1px_0px_rgba(0,0,0,1)]">
                            {(letter.student?.full_name || '?').charAt(0)}
                          </div>
                          <div>
                            <p className="font-extrabold text-xs text-zinc-900 leading-tight">
                              {letter.student?.full_name || 'Deleted Student'}
                            </p>
                            <p className="text-[9px] text-zinc-550 font-bold">
                              {letter.student?.roll_number || 'N/A'}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={letter.status} />
                      </div>

                      <div className="border-t border-dashed border-black/10 pt-2 flex flex-col gap-1 text-[11px] font-bold text-zinc-700">
                        <p><span className="text-zinc-400">Type:</span> {letter.letter_types.name}</p>
                        <p className="flex items-center gap-1">
                          <span className="text-zinc-400">Submitted:</span> 
                          <Calendar className="w-3.5 h-3.5 shrink-0" /> 
                          {new Date(letter.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>

                      <div className="pt-2 text-right">
                        <Link
                          href={`/faculty/review/${letter.id}`}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold text-black bg-neuyellow border-2 border-black rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all"
                        >
                          {isPendingForUser(letter) ? 'Review & Sign' : 'View Details'}{' '}
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            </div>{/* /tableRef */}
          </>
        ) : (
          <div className="space-y-6">
            {adminActionError && (
              <div className="p-4 rounded-xl bg-neured border-2 border-black text-black flex items-start gap-3 text-xs font-semibold shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>{adminActionError}</div>
              </div>
            )}

            {adminActionSuccess && (
              <div className="p-4 rounded-xl bg-neugreen border-2 border-black text-black flex items-start gap-3 text-xs font-bold shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <div>Account added and activated successfully!</div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-black">Department Directory</h2>
                <p className="text-xs text-zinc-650 font-bold mt-0.5">Manage authenticated credentials in your department.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setBulkFile(null);
                    setBulkProgress(null);
                    setBulkErrors([]);
                    setBulkImporting(false);
                    setShowBulkModal(true);
                  }}
                  className="paper-btn inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-neuyellow!"
                >
                  Bulk Import (CSV)
                </button>
                <button
                  onClick={() => {
                    setAdminActionError(null);
                    setAdminActionSuccess(false);
                    setShowAddUserModal(true);
                  }}
                  className="paper-btn inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-neugreen!"
                >
                  Add Account
                </button>
              </div>
            </div>

            {loadingProfiles ? (
              <div className="paper-card py-16 text-center flex flex-col items-center justify-center gap-3 rounded-2xl">
                <RefreshCw className="w-8 h-8 animate-spin text-black" />
                <p className="text-xs font-mono font-bold">Loading department members...</p>
              </div>
            ) : deptProfiles.length === 0 ? (
              <div className="paper-card py-16 text-center rounded-2xl">
                <p className="text-xs text-zinc-550 font-bold">No registered members found in your department.</p>
              </div>
            ) : (
              <div className="paper-card border-2 border-black rounded-2xl overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y-2 divide-black text-left">
                    <thead className="bg-zinc-100 text-black text-xs font-bold uppercase tracking-wider border-b-2 border-black">
                      <tr>
                        <th className="px-6 py-4 border-r-2 border-black">Full Name</th>
                        <th className="px-6 py-4 border-r-2 border-black">Role</th>
                        <th className="px-6 py-4 border-r-2 border-black">Reference ID / Roll No</th>
                        <th className="px-6 py-4 border-r-2 border-black">Designation / Department</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 text-sm font-semibold text-black">
                      {deptProfiles.map((member, idx) => (
                        <tr
                          key={member.id}
                          className="hover:bg-neuyellow/10 transition-colors animate-row-in"
                          style={{ animationDelay: `${idx * 35}ms` }}
                        >
                          <td className="px-6 py-4 border-r-2 border-black whitespace-nowrap">
                            <span className="font-extrabold">{member.full_name}</span>
                          </td>
                          <td className="px-6 py-4 border-r-2 border-black whitespace-nowrap">
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded border-2 border-black shadow-[1px_1px_0px_rgba(0,0,0,1)] ${
                              member.role === 'student' ? 'bg-neublue' : 'bg-neugreen'
                            }`}>
                              {member.role.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 border-r-2 border-black whitespace-nowrap font-mono text-xs">
                            {member.role === 'student' ? (
                              <span className="font-bold">{member.roll_number}</span>
                            ) : (
                              <span className="text-zinc-400">{member.id.slice(0, 8)}...</span>
                            )}
                          </td>
                          <td className="px-6 py-4 border-r-2 border-black whitespace-nowrap text-zinc-650 font-bold">
                            {member.role === 'student' ? 'Student' : member.designation || 'Faculty'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            {member.id !== profile?.id && (
                              <button
                                onClick={() => handleDeleteUser(member.id)}
                                disabled={actionLoading}
                                className="px-2.5 py-1 bg-neured! text-black border-2 border-black rounded-lg text-xs font-bold shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all cursor-pointer"
                              >
                                Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Upload Signature Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-overlay-in">
          <div className="bg-white dark:bg-zinc-900 border-2 border-black max-w-md w-full p-6 rounded-2xl shadow-[6px_6px_0px_rgba(0,0,0,1)] space-y-4 animate-slide-in-modal">
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Update Digital Signature</h3>
              <p className="text-xs text-zinc-550 dark:text-zinc-450 mt-0.5">
                Upload a new image of your signature. PNG format with transparent background is highly recommended.
              </p>
            </div>

            {uploadError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 dark:text-rose-405">
                {uploadError}
              </div>
            )}

            {uploadSuccess ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600 dark:text-emerald-455 font-semibold text-center animate-pulse">
                Signature updated successfully!
              </div>
            ) : (
              <form onSubmit={handleSignatureUpdate} className="space-y-4">
                <input
                  type="file"
                  accept="image/png"
                  required
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setNewSignatureFile(e.target.files[0]);
                    }
                  }}
                  className="block w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-zinc-800 dark:file:text-zinc-300"
                />

                <div className="flex justify-end gap-3 text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setNewSignatureFile(null);
                      setUploadError(null);
                    }}
                    className="px-4 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-xl font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingSignature || !newSignatureFile}
                    className="px-4.5 py-2 text-white bg-indigo-650 hover:bg-indigo-700 rounded-xl font-bold disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {uploadingSignature ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Signature'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* HOD Add Department Member Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-overlay-in">
          <div className="bg-white border-2 border-black max-w-md w-full p-6 rounded-2xl shadow-xl space-y-4 text-black animate-slide-in-modal">
            <div>
              <h3 className="text-lg font-black text-black">Add Department Member</h3>
              <p className="text-xs text-zinc-650 mt-0.5 font-bold">
                Assign a secure login and profile for a new student or faculty member in your department.
              </p>
            </div>

            {adminActionError && (
              <div className="p-3 bg-neured border-2 border-black rounded-xl text-xs text-black font-bold">
                {adminActionError}
              </div>
            )}

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="mt-1.5 block w-full px-3 py-2 bg-neuyellow text-black border-2 border-black rounded-xl text-sm font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all"
                >
                  <option value="student" className="bg-white text-black font-bold">Student</option>
                  <option value="faculty" className="bg-white text-black font-bold">Faculty Member</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. K. Ramesh / Rahul Reddy"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1.5 block w-full px-3 py-2 bg-white text-black border-2 border-black rounded-xl text-sm font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all"
                />
              </div>

              {newRole === 'student' ? (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-black">Roll Number (10 Chars)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 24AK1A33D8"
                    maxLength={10}
                    value={newRollNumber}
                    onChange={(e) => setNewRollNumber(e.target.value.toUpperCase())}
                    className="mt-1.5 block w-full px-3 py-2 bg-neugreen text-black border-2 border-black rounded-xl text-sm font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all"
                  />
                  <p className="mt-1 text-[10px] text-zinc-500 font-semibold font-mono">
                    Email: {newRollNumber ? newRollNumber.toLowerCase() : 'rollno'}@aits-tpt.edu.in
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-black">Official Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. ramesh.k@aits-tpt.edu.in"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="mt-1.5 block w-full px-3 py-2 bg-white text-black border-2 border-black rounded-xl text-sm font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-black">Designation</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Assistant Professor / Class Mentor"
                      value={newDesignation}
                      onChange={(e) => setNewDesignation(e.target.value)}
                      className="mt-1.5 block w-full px-3 py-2 bg-white text-black border-2 border-black rounded-xl text-sm font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1.5 block w-full px-3 py-2 bg-neured/30 text-black border-2 border-black rounded-xl text-sm font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all"
                />
              </div>

              <div className="flex justify-end gap-3 text-sm pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 border-2 border-black hover:bg-zinc-100 rounded-xl font-bold bg-white text-black shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4.5 py-2 paper-btn bg-neugreen! text-black rounded-xl font-bold inline-flex items-center gap-1.5"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Creating...
                    </>
                  ) : (
                    'Add Member'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HOD Bulk Import Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-overlay-in">
          <div className="bg-white border-2 border-black max-w-lg w-full p-6 rounded-2xl shadow-xl space-y-4 text-black animate-slide-in-modal">
            <div>
              <h3 className="text-lg font-black text-black">Bulk Import Directory Accounts</h3>
              <p className="text-xs text-zinc-650 mt-0.5 font-bold">
                Upload a CSV spreadsheet to register multiple students or faculty members.
              </p>
            </div>

            <div className="p-3 bg-zinc-50 border-2 border-black rounded-xl text-xs font-semibold space-y-2">
              <p className="font-extrabold text-black">Spreadsheet CSV Format Guidelines:</p>
              <p className="font-mono text-[10px] text-zinc-600 bg-white p-2 border border-zinc-200 rounded">
                role,name,identifier,password,designation<br/>
                student,Rahul Reddy,24AK1A33D8,studentpwd,<br/>
                faculty,Dr. K Ramesh,ramesh.k@aits-tpt.edu.in,facultypwd,Mentor
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-zinc-500">
                <li>**role**: Either <code className="font-bold text-black">student</code> or <code className="font-bold text-black">faculty</code></li>
                <li>**identifier**: Student **roll number** OR Faculty **email address**</li>
                <li>**designation**: Required only for faculty (leave blank for students)</li>
              </ul>
            </div>

            {bulkProgress && (
              <div className="p-4 border-2 border-black rounded-xl space-y-2 text-xs bg-zinc-50 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                <div className="flex justify-between font-bold text-black">
                  <span>Import Progress</span>
                  <span>{bulkProgress.current} / {bulkProgress.total} Rows</span>
                </div>
                <div className="w-full bg-zinc-200 h-3 border-2 border-black rounded-full overflow-hidden">
                  <div 
                    className="bg-neugreen h-full transition-all duration-300"
                    style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between font-bold text-[10px] text-zinc-700">
                  <span className="text-emerald-700">Succeeded: {bulkProgress.success}</span>
                  <span className="text-rose-700">Failed: {bulkProgress.failed}</span>
                </div>
              </div>
            )}

            {bulkErrors.length > 0 && (
              <div className="p-3 bg-neured border-2 border-black rounded-xl text-xs text-black font-semibold max-h-40 overflow-y-auto space-y-1">
                <p className="font-extrabold mb-1">Errors logged ({bulkErrors.length}):</p>
                {bulkErrors.map((err, i) => (
                  <p key={i} className="font-mono text-[10px] leading-tight">• {err}</p>
                ))}
              </div>
            )}

            <form onSubmit={handleBulkImport} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black">Select CSV Spreadsheet File</label>
                <input
                  type="file"
                  accept=".csv"
                  required
                  disabled={bulkImporting}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setBulkFile(e.target.files[0]);
                    }
                  }}
                  className="mt-1.5 block w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-2 file:border-black file:text-xs file:font-black file:bg-neuyellow file:text-black hover:file:translate-x-[-1px] hover:file:translate-y-[-1px] hover:file:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:file:translate-x-0 active:file:translate-y-0 active:file:shadow-none file:transition-all file:cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-3 text-sm pt-2">
                <button
                  type="button"
                  disabled={bulkImporting}
                  onClick={() => {
                    setShowBulkModal(false);
                    setBulkFile(null);
                    setBulkProgress(null);
                    setBulkErrors([]);
                  }}
                  className="px-4 py-2 border-2 border-black hover:bg-zinc-100 rounded-xl font-bold bg-white text-black shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all disabled:opacity-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={bulkImporting || !bulkFile}
                  className="px-4.5 py-2 paper-btn bg-neugreen! text-black rounded-xl font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {bulkImporting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Importing...
                    </>
                  ) : (
                    'Start Import'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
