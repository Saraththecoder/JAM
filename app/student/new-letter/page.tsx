'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  FileText, ArrowLeft, ArrowRight, Sparkles, Send, 
  RefreshCw, AlertCircle, Calendar, Clock, MapPin, AlignLeft, ShieldCheck 
} from 'lucide-react';
import Navbar from '@/components/Navbar';

interface LetterType {
  id: string;
  name: string;
  requires_ai: boolean;
  template: string;
}

interface Faculty {
  id: string;
  full_name: string;
  designation: string;
}

interface StudentProfile {
  id: string;
  full_name: string;
  roll_number: string;
  department_id: string;
  departments: {
    name: string;
  };
}

export default function NewLetterPage() {
  const router = useRouter();
  const supabase = createClient();

  // Step state: 1 = Type & Faculty, 2 = Fields/AI key, 3 = Preview & Edit
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // DB Data
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [letterTypes, setLetterTypes] = useState<LetterType[]>([]);
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);

  // Selection state
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [selectedMentorId, setSelectedMentorId] = useState('');
  const [selectedHodId, setSelectedHodId] = useState('');

  // Form inputs state
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [aiDescription, setAiDescription] = useState('');
  const [aiTone, setAiTone] = useState('formal');

  // Compiled body state
  const [generatedBody, setGeneratedBody] = useState('');

  // Fetch initial student profile, letter types, and faculty in the same department
  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.push('/login');
          return;
        }

        // 1. Fetch student profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, roll_number, department_id, departments(name)')
          .eq('id', user.id)
          .single();

        if (profileError || !profile) {
          throw new Error('Failed to retrieve student profile.');
        }
        setStudent(profile as any);

        // 2. Fetch letter types
        const { data: types, error: typesError } = await supabase
          .from('letter_types')
          .select('*')
          .order('name');
        
        if (typesError) throw typesError;
        setLetterTypes(types || []);
        if (types && types.length > 0) {
          setSelectedTypeId(types[0].id);
        }

        // 3. Fetch approved faculty in the student's department
        const { data: faculty, error: facultyError } = await supabase
          .from('profiles')
          .select('id, full_name, designation')
          .eq('role', 'faculty')
          .eq('is_approved', true)
          .eq('department_id', profile.department_id)
          .order('full_name');

        if (facultyError) throw facultyError;
        setFacultyList(faculty || []);
        if (faculty && faculty.length > 0) {
          setSelectedMentorId(faculty[0].id);
        }

        // Retrieve OpenRouter key from sessionStorage if it exists
        if (typeof window !== 'undefined') {
          const savedKey = sessionStorage.getItem('openrouter_api_key');
          if (savedKey) setOpenRouterKey(savedKey);
        }

      } catch (err: any) {
        console.error('Error loading data:', err);
        setError(err.message || 'Failed to initialize request form.');
      } finally {
        setFetchingData(false);
      }
    }
    loadData();
  }, [router, supabase]);

  const selectedType = letterTypes.find(t => t.id === selectedTypeId);
  const selectedMentor = facultyList.find(f => f.id === selectedMentorId);
  const selectedHod = facultyList.find(f => f.id === selectedHodId);

  // Handle template placeholder replacements
  const compileTemplate = (templateStr: string, data: Record<string, string>) => {
    let result = templateStr;
    
    // Default placeholders
    result = result.replaceAll('{student_name}', student?.full_name || '');
    result = result.replaceAll('{roll_number}', student?.roll_number || '');
    result = result.replaceAll('{mentor_name}', selectedMentor?.full_name || '');
    result = result.replaceAll('{hod_name}', selectedHod?.full_name || '');
    result = result.replaceAll('{faculty_name}', selectedHod?.full_name || '');

    // Form-specific placeholders
    Object.entries(data).forEach(([key, val]) => {
      result = result.replaceAll(`{${key}}`, val);
    });

    return result;
  };

  // Form fields builder depending on selected type
  const renderFormFields = () => {
    if (!selectedType) return null;

    if (selectedType.requires_ai) {
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-black dark:text-zinc-350">
              OpenRouter API Key (BYOK)
            </label>
            <input
              type="password"
              placeholder="sk-or-v1-..."
              value={openRouterKey}
              onChange={(e) => setOpenRouterKey(e.target.value)}
              className="mt-1.5 block w-full px-3 py-2.5 bg-neured/70 text-black placeholder-black/55 border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
              required
            />
            <p className="mt-1 text-xs text-zinc-550 font-semibold">
              Your key is only saved in this browser tab's session memory. It is never stored on our database.
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold text-black dark:text-zinc-350">
              Describe the letter you need
            </label>
            <textarea
              rows={4}
              maxLength={1500}
              placeholder="e.g. Requesting permission to present my research paper on deep learning at the National Tech Conference next Monday. I need duty leave for that day."
              value={aiDescription}
              onChange={(e) => setAiDescription(e.target.value)}
              className="mt-1.5 block w-full px-3 py-2.5 bg-white text-black placeholder-zinc-400 border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-black dark:text-zinc-350">
              Tone of the Letter
            </label>
            <select
              value={aiTone}
              onChange={(e) => setAiTone(e.target.value)}
              className="mt-1.5 block w-full px-3 py-2.5 bg-neuyellow text-black border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
            >
              <option value="formal" className="bg-white text-black">Formal & Respectful (Recommended)</option>
              <option value="casual" className="bg-white text-black">Earnest & Clear</option>
            </select>
          </div>
        </div>
      );
    }

    // Standard letter fields
    switch (selectedType.name) {
      case 'Leave Letter':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-black dark:text-zinc-305">Start Date</label>
                <input
                  type="date"
                  required
                  value={formData.start_date || ''}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="mt-1.5 block w-full px-3 py-2.5 bg-neugreen text-black border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-black dark:text-zinc-305">End Date</label>
                <input
                  type="date"
                  required
                  value={formData.end_date || ''}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="mt-1.5 block w-full px-3 py-2.5 bg-neugreen text-black border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-black dark:text-zinc-305">Reason for Leave</label>
              <textarea
                rows={3}
                maxLength={300}
                placeholder="e.g. fever / attending sister's marriage"
                required
                value={formData.reason || ''}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="mt-1.5 block w-full px-3 py-2.5 bg-white text-black placeholder-zinc-400 border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
              />
            </div>
          </div>
        );

      case 'Permission Letter':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-black dark:text-zinc-305">Activity / Event Name</label>
              <input
                type="text"
                placeholder="e.g. attending Hackathon at IIT Madras"
                required
                value={formData.activity || ''}
                onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                className="mt-1.5 block w-full px-3 py-2.5 bg-white text-black placeholder-zinc-400 border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold text-black dark:text-zinc-305">Date</label>
                <input
                  type="date"
                  required
                  value={formData.date || ''}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="mt-1.5 block w-full px-3 py-2.5 bg-neugreen text-black border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-black dark:text-zinc-305">Start Time</label>
                <input
                  type="time"
                  required
                  value={formData.start_time || ''}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="mt-1.5 block w-full px-3 py-2.5 bg-neured text-black border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-black dark:text-zinc-305">End Time</label>
                <input
                  type="time"
                  required
                  value={formData.end_time || ''}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="mt-1.5 block w-full px-3 py-2.5 bg-neured text-black border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-black dark:text-zinc-305">Venue</label>
              <input
                type="text"
                placeholder="e.g. Seminar Hall / College Ground"
                required
                value={formData.venue || ''}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                className="mt-1.5 block w-full px-3 py-2.5 bg-white text-black placeholder-zinc-400 border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
              />
            </div>
          </div>
        );

      case 'Event Conduct Letter':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-black dark:text-zinc-305">Event Name</label>
                <input
                  type="text"
                  placeholder="e.g. AI-TechFest 2026"
                  required
                  value={formData.event_name || ''}
                  onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                  className="mt-1.5 block w-full px-3 py-2.5 bg-white text-black placeholder-zinc-400 border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-black dark:text-zinc-305">Date of Event</label>
                <input
                  type="date"
                  required
                  value={formData.date || ''}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="mt-1.5 block w-full px-3 py-2.5 bg-neugreen text-black border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-black dark:text-zinc-305">Venue</label>
                <input
                  type="text"
                  placeholder="e.g. Lab 4 / Seminar Hall"
                  required
                  value={formData.venue || ''}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  className="mt-1.5 block w-full px-3 py-2.5 bg-white text-black placeholder-zinc-400 border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-black dark:text-zinc-305">Expected Participants</label>
                <input
                  type="number"
                  placeholder="e.g. 150"
                  required
                  value={formData.expected_participants || ''}
                  onChange={(e) => setFormData({ ...formData, expected_participants: e.target.value })}
                  className="mt-1.5 block w-full px-3 py-2.5 bg-white text-black placeholder-zinc-400 border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-black dark:text-zinc-305">Event Purpose / Objective</label>
              <textarea
                rows={3}
                maxLength={300}
                placeholder="e.g. introduce students to Large Language Models and deployment frameworks"
                required
                value={formData.event_purpose || ''}
                onChange={(e) => setFormData({ ...formData, event_purpose: e.target.value })}
                className="mt-1.5 block w-full px-3 py-2.5 bg-white text-black placeholder-zinc-400 border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
              />
            </div>
          </div>
        );

      case 'Property Request Letter':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-black dark:text-zinc-305">Property / Lab Name</label>
              <input
                type="text"
                placeholder="e.g. GPU Computing Lab"
                required
                value={formData.property_name || ''}
                onChange={(e) => setFormData({ ...formData, property_name: e.target.value })}
                className="mt-1.5 block w-full px-3 py-2.5 bg-white text-black placeholder-zinc-400 border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold text-black dark:text-zinc-305">Booking Date</label>
                <input
                  type="date"
                  required
                  value={formData.date || ''}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="mt-1.5 block w-full px-3 py-2.5 bg-neugreen text-black border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-black dark:text-zinc-305">From Time</label>
                <input
                  type="time"
                  required
                  value={formData.start_time || ''}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="mt-1.5 block w-full px-3 py-2.5 bg-neured text-black border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-black dark:text-zinc-305">To Time</label>
                <input
                  type="time"
                  required
                  value={formData.end_time || ''}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="mt-1.5 block w-full px-3 py-2.5 bg-neured text-black border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-black dark:text-zinc-305">Purpose of Booking</label>
              <textarea
                rows={3}
                maxLength={300}
                placeholder="e.g. running deep learning training epochs for the final year project"
                required
                value={formData.purpose || ''}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                className="mt-1.5 block w-full px-3 py-2.5 bg-white text-black placeholder-zinc-400 border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
              />
            </div>
          </div>
        );

      case 'Outing Pass':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold text-black dark:text-zinc-305">Date</label>
                <input
                  type="date"
                  required
                  value={formData.date || ''}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="mt-1.5 block w-full px-3 py-2.5 bg-neugreen text-black border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-black dark:text-zinc-305">Leave Time</label>
                <input
                  type="time"
                  required
                  value={formData.leave_time || ''}
                  onChange={(e) => setFormData({ ...formData, leave_time: e.target.value })}
                  className="mt-1.5 block w-full px-3 py-2.5 bg-neured text-black border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-black dark:text-zinc-305">Return Time</label>
                <input
                  type="time"
                  required
                  value={formData.return_time || ''}
                  onChange={(e) => setFormData({ ...formData, return_time: e.target.value })}
                  className="mt-1.5 block w-full px-3 py-2.5 bg-neured text-black border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-black dark:text-zinc-305">Destination</label>
              <input
                type="text"
                placeholder="e.g. City Library / Local hospital"
                required
                value={formData.destination || ''}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                className="mt-1.5 block w-full px-3 py-2.5 bg-white text-black placeholder-zinc-400 border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-black dark:text-zinc-305">Reason for Outing</label>
              <textarea
                rows={3}
                maxLength={300}
                placeholder="e.g. reference books purchase / eye checkup"
                required
                value={formData.reason || ''}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="mt-1.5 block w-full px-3 py-2.5 bg-white text-black placeholder-zinc-400 border-2 border-black font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all rounded-xl text-sm"
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="p-4 bg-zinc-100 border-2 border-black rounded-xl text-xs text-black font-bold">
            Selected template does not have custom fields. Use AI generation or edit directly.
          </div>
        );
    }
  };

  const handleNextStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (step === 1) {
      if (!selectedTypeId || !selectedMentorId) {
        setError('Please select a letter type and a class mentor.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!selectedType) return;
      
      setLoading(true);

      try {
        if (selectedType.requires_ai) {
          // AI Letter compilation via BYOK OpenRouter API proxy
          if (!openRouterKey) {
            throw new Error('An OpenRouter API key is required to generate this letter.');
          }

          // Save API key client-side in sessionStorage for convenience
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('openrouter_api_key', openRouterKey);
          }

          const response = await fetch('/api/generate-ai-body', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: aiDescription,
              tone: aiTone,
              openRouterKey,
            }),
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Failed to generate letter body via AI.');
          }

          // Merge generated AI body into the custom template
          const compiled = compileTemplate(selectedType.template, {
            ai_generated_body: data.body,
          });
          setGeneratedBody(compiled);
        } else {
          // Standard template interpolation
          const compiled = compileTemplate(selectedType.template, formData);
          setGeneratedBody(compiled);
        }
        
        setStep(3);
      } catch (err: any) {
        console.error('Error generating letter body:', err);
        setError(err.message || 'An error occurred during letter body compilation.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSubmitLetter = async () => {
    if (!generatedBody.trim()) {
      setError('Letter body cannot be empty.');
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      // 1. Insert letter record in DB
      const { data: newLetter, error: insertError } = await supabase
        .from('letters')
        .insert({
          student_id: student?.id,
          faculty_id: selectedMentorId, 
          mentor_id: selectedMentorId,
          hod_id: null,
          letter_type_id: selectedTypeId,
          form_data: selectedType?.requires_ai 
            ? { description: aiDescription, tone: aiTone } 
            : formData,
          generated_body: generatedBody,
          status: 'pending_mentor', 
        })
        .select('id')
        .single();

      if (insertError) {
        throw new Error(`Failed to save letter request: ${insertError.message}`);
      }

      // 2. Trigger notification email to faculty via local API route (asynchronous)
      // This endpoint sends Resend notifications. We call it in the background.
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          letterId: newLetter.id,
          type: 'new_request',
        }),
      }).catch(err => console.error('Notification trigger failed:', err));

      // 3. Return to student dashboard
      router.push('/student/dashboard');
      router.refresh();

    } catch (err: any) {
      console.error('Error sending letter:', err);
      setError(err?.message || 'Failed to submit letter request. Please try again.');
      setLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-zinc-500 bg-grid-pattern">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm">Initializing request wizard...</p>
      </div>
    );
  }

  if (facultyList.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-grid-pattern">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-2xl text-center shadow-md">
          <ShieldCheck className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">No Active Faculty Found</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
            There are currently no approved faculty members in the {student?.departments?.name || 'AI&ML'} department to sign your letter. Please ask your class teacher/HOD to register and obtain approval.
          </p>
          <Link
            href="/student/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 rounded-xl text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-[#1c1a17] flex flex-col pb-12">
      <Navbar
        role="wizard"
        profile={student}
        backAction={() => {
          if (step > 1) setStep(step - 1);
          else router.push('/student/dashboard');
        }}
        backText={step === 1 ? 'Dashboard' : 'Back'}
        stepText={`Step ${step} of 3`}
      />

      {/* Main Request Form Card */}
      <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 mt-6 sm:mt-8 flex-grow">
        <div className="paper-card p-5 sm:p-6 md:p-8 rounded-2xl">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-neured border-2 border-black text-black flex items-start gap-3 text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)] font-semibold">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleNextStep} className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-black dark:text-white">
                  Select Letter Type & Faculty
                </h2>
                <p className="text-xs text-zinc-600 mt-1 font-semibold">
                  Choose the template type and the faculty reviewer from your department.
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-black dark:text-zinc-300">
                  Letter Template
                </label>
                <select
                  value={selectedTypeId}
                  onChange={(e) => setSelectedTypeId(e.target.value)}
                  className="mt-1.5 block w-full px-3 py-2.5 bg-neuyellow text-black border-2 border-black rounded-xl text-sm font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all"
                >
                  {letterTypes.map((type) => (
                    <option 
                      key={type.id} 
                      value={type.id} 
                      className="bg-white text-black"
                    >
                      {type.name} {type.requires_ai ? '✨ (AI-Assisted)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-black dark:text-zinc-300">
                  Class Mentor (First Reviewer)
                </label>
                <select
                  value={selectedMentorId}
                  onChange={(e) => setSelectedMentorId(e.target.value)}
                  className="mt-1.5 block w-full px-3 py-2.5 bg-neuyellow text-black border-2 border-black rounded-xl text-sm font-bold focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all"
                >
                  {facultyList.map((fac) => (
                    <option 
                      key={fac.id} 
                      value={fac.id} 
                      className="bg-white text-black"
                    >
                      {fac.full_name} ({fac.designation})
                    </option>
                  ))}
                </select>
              </div>



              <button
                type="submit"
                className="w-full paper-btn flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleNextStep} className="space-y-6">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-black dark:text-white">
                    {selectedType?.name} Form
                  </h2>
                  {selectedType?.requires_ai && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-neublue text-black rounded-lg border-2 border-black shadow-[1px_1px_0px_rgba(0,0,0,1)]">
                      <Sparkles className="w-3 h-3 animate-spin animate-duration-1000" /> AI Generated
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-600 mt-1 font-semibold">
                  Fill in the variable template fields to draft the letter content.
                </p>
              </div>

              {renderFormFields()}

              <button
                type="submit"
                disabled={loading}
                className="w-full paper-btn flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin animate-duration-1000" />
                    {selectedType?.requires_ai ? 'AI is drafting...' : 'Compiling...'}
                  </>
                ) : (
                  <>
                    Generate Preview <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-black dark:text-white">
                  Review & Edit Letter Body
                </h2>
                <p className="text-xs text-zinc-650 dark:text-zinc-450 mt-1 font-semibold">
                  Verify the compiled letter paragraphs below. You can make manual inline adjustments if needed before submitting.
                </p>
              </div>

              <div className="space-y-4">
                {/* Header preview elements */}
                <div className="p-4 bg-neuyellow/30 text-black rounded-xl border-2 border-black text-xs font-mono font-bold space-y-2">
                  <p className="text-right">Date: {(() => {
                    const d = new Date();
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year = d.getFullYear();
                    return `${day}/${month}/${year}`;
                  })()}</p>
                  <div>
                    <p className="font-semibold text-zinc-700 dark:text-zinc-300">To,</p>
                    <p>HOD: {selectedHod?.full_name}</p>
                    <p>Via Class Mentor: {selectedMentor?.full_name}</p>
                    <p>Department of {student?.departments?.name}, AITS.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-700 dark:text-zinc-300">From,</p>
                    <p>{student?.full_name} ({student?.roll_number})</p>
                    <p>Department of {student?.departments?.name}, AITS.</p>
                  </div>
                  <p className="font-bold text-black">
                    Subject: Request for {selectedType?.name} - Reg.
                  </p>
                </div>

                {/* Editable letter body */}
                <div>
                  <label className="block text-sm font-bold text-black dark:text-zinc-250 mb-1.5">
                    Letter Body (Paragraphs)
                  </label>
                  <textarea
                    rows={12}
                    maxLength={1800}
                    value={generatedBody}
                    onChange={(e) => setGeneratedBody(e.target.value)}
                    className="w-full px-4 py-3 bg-white text-black font-mono font-bold border-2 border-black rounded-xl focus:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all text-sm leading-relaxed"
                  />
                </div>
              </div>

              <button
                onClick={handleSubmitLetter}
                disabled={loading}
                className="w-full paper-btn flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl text-sm font-bold disabled:opacity-50 bg-neugreen!"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sending Request...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Send Request to Faculty
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
