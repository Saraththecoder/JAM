-- 1. Add new enum values for letter status
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a multi-statement transaction in older Postgres, 
-- but in Supabase's migration execution it runs successfully.
ALTER TYPE public.letter_status ADD VALUE IF NOT EXISTS 'pending_mentor';
ALTER TYPE public.letter_status ADD VALUE IF NOT EXISTS 'pending_hod';

-- 2. Add approval workflow columns to letters table
ALTER TABLE public.letters 
ADD COLUMN IF NOT EXISTS mentor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS hod_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reference_number TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS mentor_signed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS hod_signed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Update Row Level Security (RLS) policies on letters
-- Drop the exact legacy policy names from the initial schema
DROP POLICY IF EXISTS "Allow users to read their own or addressed letters" ON public.letters;
DROP POLICY IF EXISTS "Allow faculty and student to update letters" ON public.letters;
DROP POLICY IF EXISTS "Allow read for participants" ON public.letters;
DROP POLICY IF EXISTS "Allow update for reviewers" ON public.letters;

-- Read policy: Student, Mentor, HOD, or original recipient can read the letter
CREATE POLICY "Allow read for participants" ON public.letters
    FOR SELECT TO authenticated
    USING (
        auth.uid() = student_id OR 
        auth.uid() = mentor_id OR 
        auth.uid() = hod_id OR 
        auth.uid() = faculty_id
    );

-- Public verification policy: Anyone can read approved letters (for QR verification page)
CREATE POLICY "Allow public read for approved letters" ON public.letters
    FOR SELECT TO anon, authenticated
    USING (status = 'approved');

-- Update policy: Mentor/HOD reviewers, or students if the letter is still pending mentor review
CREATE POLICY "Allow update for reviewers and creators" ON public.letters
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = mentor_id OR 
        auth.uid() = hod_id OR 
        (auth.uid() = student_id AND status = 'pending_mentor'::letter_status)
    );

-- 4. Column-Level Security (CLS) for sensitive faculty signature path
-- Revoke read access on the signature storage path column from anonymous and standard authenticated users
REVOKE SELECT (esign_storage_path) ON public.profiles FROM public, anon, authenticated;

-- Grant select access on the column exclusively to the service_role (used by backend admin client)
GRANT SELECT (esign_storage_path) ON public.profiles TO service_role;

