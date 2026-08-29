'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ShieldCheck, ShieldAlert, FileText, Calendar, User, Clock, CheckCircle } from 'lucide-react';

interface Letter {
  id: string;
  created_at: string;
  generated_body: string;
  status: string;
  reference_number: string | null;
  mentor_signed_at: string | null;
  hod_signed_at: string | null;
  pdf_hash: string | null;
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

export default function VerificationPage() {
  const params = useParams();
  const letterId = params.id as string;

  const [letter, setLetter] = useState<Letter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cryptographic integrity check states
  const [integrityStatus, setIntegrityStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [computedHash, setComputedHash] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const supabase = createClient();

  const handleFileVerification = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      setComputedHash(hashHex);
      if (hashHex === letter?.pdf_hash) {
        setIntegrityStatus('success');
      } else {
        setIntegrityStatus('failed');
      }
    } catch (e) {
      console.error('Integrity verification failed:', e);
      setIntegrityStatus('failed');
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch(`/api/download-letter/${letterId}`);
      const contentType = res.headers.get('content-type');
      
      if (!res.ok || !contentType || !contentType.includes('application/json')) {
        let errorMsg = 'Failed to generate download link.';
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } else if (res.ok && contentType && contentType.includes('text/html')) {
          errorMsg = 'Failed to fetch PDF path: Redirected to login page or template not found. Please log in or check permission scopes.';
        } else {
          errorMsg = `Server error (${res.status}): ${res.statusText || 'Verify your environment config (Supabase Service Role Key).'}`;
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      
      // Trigger programmatic download of the file
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.setAttribute('download', ''); // Browser honors attachment header filename
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Download error:', err);
      setDownloadError(err.message || 'Could not download PDF.');
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    async function verifyDocument() {
      if (!letterId) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .rpc('verify_letter', { p_letter_id: letterId });

        if (fetchError || !data) {
          throw new Error('This document does not exist, is pending approval, or has been revoked.');
        }

        setLetter(data as any);
      } catch (err: any) {
        console.error('Verification error:', err);
        setError(err.message || 'Could not verify document.');
      } finally {
        setLoading(false);
      }
    }

    verifyDocument();
  }, [letterId, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center gap-3 text-zinc-550 font-bold">
        <Clock className="w-8 h-8 animate-spin text-black" />
        <p className="text-xs font-mono font-semibold">Verifying secure digital signature hashes...</p>
      </div>
    );
  }

  if (error || !letter) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-6">
        <div className="max-w-md w-full paper-card bg-neured p-8 text-center rounded-2xl border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          <ShieldAlert className="w-16 h-16 text-black mx-auto mb-4" />
          <h2 className="text-xl font-serif font-black text-black mb-2">Verification Failed</h2>
          <p className="text-xs text-black/85 mb-6 leading-relaxed font-bold">
            {error || 'This QR link is invalid. The document has not been signed or may have been revoked.'}
          </p>
          <div className="p-3 bg-white text-black border-2 border-black rounded-xl text-[10px] font-mono font-bold shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            AITS Tirupati Department of AI&ML Document Authentication Services.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent py-8 sm:py-12 px-4 sm:px-6 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full paper-card rounded-3xl overflow-hidden bg-white border-2 border-black shadow-[6px_6px_0px_rgba(0,0,0,1)]">
        {/* Header Ribbon */}
        <div className="bg-neugreen text-black p-6 flex items-center gap-4 border-b-2 border-black">
          <div className="p-3 bg-white text-black rounded-2xl border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            <ShieldCheck className="w-8 h-8 text-black" />
          </div>
          <div>
            <h1 className="text-lg font-serif font-black uppercase tracking-wider text-black">Original Document Verified</h1>
            <p className="text-[10px] font-mono text-black/85 mt-0.5 font-bold">Digitally signed and archived in the AITS ERP system.</p>
          </div>
        </div>

        {/* Verification Summary */}
        <div className="p-5 sm:p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-2 gap-4 text-xs font-mono border-b-2 border-black pb-6">
            <div>
              <p className="text-[10px] text-zinc-600 font-extrabold uppercase tracking-wider">Reference Number</p>
              <p className="font-black text-black mt-1">{letter.reference_number}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 font-extrabold uppercase tracking-wider">Document Type</p>
              <p className="font-black text-black mt-1">{letter.letter_types?.name || 'Letter'}</p>
            </div>
          </div>

          {/* Student details */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-black mb-3 flex items-center gap-1.5 font-sans">
              <User className="w-4 h-4 text-black" /> Student Details
            </h3>
            <div className="grid grid-cols-2 gap-4 bg-neuyellow/20 p-4 rounded-xl text-xs space-y-0 text-black border-2 border-black font-bold">
              <div>
                <span className="text-zinc-600 font-bold">Full Name:</span>
                <p className="font-extrabold text-black mt-0.5">{letter.student?.full_name || 'Deleted Student'}</p>
              </div>
              <div>
                <span className="text-zinc-600 font-bold">Roll Number:</span>
                <p className="font-extrabold text-black mt-0.5 font-mono">{letter.student?.roll_number || 'N/A'}</p>
              </div>
              <div className="col-span-2 pt-2 border-t-2 border-black/30">
                <span className="text-zinc-600 font-bold">Department:</span>
                <p className="font-extrabold text-black mt-0.5">
                  Department of {letter.student?.departments?.name || 'AI&ML'}, AITS Tirupati
                </p>
              </div>
            </div>
          </div>

          {/* Approval Signatures Log */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-black mb-3 flex items-center gap-1.5 font-sans">
              <CheckCircle className="w-4 h-4 text-emerald-600" /> Digital Signatures Log
            </h3>
            <div className="space-y-3">
              {/* Mentor Recommendation */}
              <div className="flex items-start gap-3 bg-neublue/30 p-4 rounded-xl text-xs border-2 border-black font-bold">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 animate-bounce animate-duration-1000" />
                <div>
                  <p className="font-extrabold text-black">Recommended by Mentor</p>
                  <p className="text-zinc-700 mt-0.5">{letter.mentor?.full_name} ({letter.mentor?.designation})</p>
                  <p className="text-[10px] text-zinc-600 mt-1 font-mono">
                    Stamped: {letter.mentor_signed_at ? new Date(letter.mentor_signed_at).toLocaleString('en-IN') : 'N/A'}
                  </p>
                </div>
              </div>

              {/* HOD Approval (Only if signed by HOD) */}
              {letter.hod_signed_at && (
                <div className="flex items-start gap-3 bg-neuyellow/30 p-4 rounded-xl text-xs border-2 border-black font-bold">
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 animate-bounce animate-duration-1000" />
                  <div>
                    <p className="font-extrabold text-black">Approved by Head of Department (HOD)</p>
                    <p className="text-zinc-700 mt-0.5">{letter.hod?.full_name} ({letter.hod?.designation})</p>
                    <p className="text-[10px] text-zinc-600 mt-1 font-mono">
                      Approved: {new Date(letter.hod_signed_at).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Letter Body Preview */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-black mb-3 flex items-center gap-1.5 font-sans">
              <FileText className="w-4 h-4 text-black" /> Letter Document Body
            </h3>
            <div className="p-4 bg-white rounded-xl border-2 border-black max-h-60 overflow-y-auto text-xs font-serif text-black whitespace-pre-wrap leading-relaxed shadow-inner italic font-medium">
              {letter.generated_body}
            </div>
          </div>

          {/* Cryptographic Checksum Check */}
          {letter.pdf_hash && (
            <div className="pt-6 border-t-2 border-dashed border-black/35 space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-black flex items-center gap-1.5 font-sans">
                <ShieldCheck className="w-4 h-4 text-black" /> Cryptographic Integrity Checker
              </h3>

              <div className="p-4 bg-zinc-100 border-2 border-black rounded-2xl text-xs space-y-1.5 text-black font-semibold shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                <p className="font-extrabold uppercase tracking-wide text-[10px]">Verification Guidance</p>
                <ul className="list-disc pl-4 space-y-1 text-zinc-700 text-[10.5px]">
                  <li>
                    <span className="font-bold text-black">Physical / Paper Check:</span> Compare the student details, signatures log, and document text body displayed on this screen directly against the printed letter. Any text mismatch indicates tampering.
                  </li>
                  <li>
                    <span className="font-bold text-black">Digital PDF Check:</span> If you received a digital PDF file, drag and drop it into the box below to run an instant SHA-256 cryptographic check confirming it has not been modified.
                  </li>
                </ul>
              </div>

              {/* Download Original Signed PDF */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-neuyellow/10 p-4 border-2 border-black rounded-2xl shadow-[2px_2px_0px_rgba(0,0,0,1)] animate-duration-500">
                <div>
                  <p className="text-xs font-extrabold text-black">Download Original Signed PDF</p>
                  <p className="text-[10px] text-zinc-600 font-semibold mt-0.5">Retrieve the authentic PDF file directly from the database registry.</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-black bg-neuyellow border-2 border-black rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all disabled:opacity-50 cursor-pointer shrink-0 inline-flex items-center justify-center gap-1.5"
                >
                  {downloading ? (
                    <>
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5" />
                      Download PDF
                    </>
                  )}
                </button>
              </div>

              {downloadError && (
                <div className="p-3 bg-neured/10 border-2 border-black rounded-xl text-[10px] text-black font-bold">
                  {downloadError}
                </div>
              )}
              
              <div 
                className={`p-6 border-2 border-dashed rounded-2xl text-center transition-all ${
                  dragActive ? 'bg-neuyellow/10 border-black scale-[0.99] shadow-inner' : 'bg-zinc-50 border-black/30 hover:border-black'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const files = e.dataTransfer.files;
                  if (files && files.length > 0) {
                    await handleFileVerification(files[0]);
                  }
                }}
              >
                <div className="flex flex-col items-center gap-2">
                  <FileText className="w-8 h-8 text-black/50" />
                  <p className="text-[11px] text-zinc-700 font-bold">
                    Drag and drop the downloaded letter PDF here, or{' '}
                    <label className="text-black underline cursor-pointer hover:text-zinc-600">
                      browse
                      <input 
                        type="file" 
                        accept="application/pdf" 
                        className="hidden" 
                        onChange={async (e) => {
                          const files = e.target.files;
                          if (files && files.length > 0) {
                            await handleFileVerification(files[0]);
                          }
                        }}
                      />
                    </label>
                  </p>
                  <p className="text-[9px] text-zinc-500 font-mono">Accepts PDF format only</p>
                </div>
              </div>

              {/* Status indicator */}
              {integrityStatus !== 'idle' && (
                <div className={`p-4 rounded-xl border-2 border-black flex items-start gap-3 shadow-[3px_3px_0px_rgba(0,0,0,1)] ${
                  integrityStatus === 'success' ? 'bg-neugreen/30' : 'bg-neured/30'
                }`}>
                  {integrityStatus === 'success' ? (
                    <ShieldCheck className="w-5 h-5 text-black shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-black shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs text-black font-bold flex-1">
                    {integrityStatus === 'success' ? (
                      <div>
                        <p className="font-extrabold uppercase tracking-wide">Integrity Verified</p>
                        <p className="text-[10px] text-black/80 font-medium mt-0.5">
                          The file is authentic. Its SHA-256 checksum matches the signed database registry hash exactly.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-extrabold uppercase tracking-wide">Checksum Mismatch</p>
                        <p className="text-[10px] text-black/80 font-medium mt-0.5">
                          The uploaded PDF file is modified, corrupted, or has been tampered with.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="text-[10px] font-mono text-black/80 mt-6 text-center font-bold">
        Annamacharya Institute of Technology & Sciences, Tirupati • Secure Verification Node
      </p>
    </div>
  );
}
