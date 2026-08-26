-- Create custom types if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('student', 'faculty');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'letter_status') THEN
    CREATE TYPE letter_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

-- 1. Create Departments table
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    branch_code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Department Codes Lookup table
CREATE TABLE IF NOT EXISTS public.department_codes (
    branch_code TEXT PRIMARY KEY,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE
);

-- 3. Create Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    roll_number TEXT UNIQUE, -- Students only
    designation TEXT, -- Faculty only
    esign_storage_path TEXT, -- Faculty only
    is_approved BOOLEAN NOT NULL DEFAULT false, -- Faculty require admin approval, Students auto-approved
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create Letter Types table
CREATE TABLE IF NOT EXISTS public.letter_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    requires_ai BOOLEAN NOT NULL DEFAULT false,
    template TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create Letters table
CREATE TABLE IF NOT EXISTS public.letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    faculty_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    letter_type_id UUID NOT NULL REFERENCES public.letter_types(id) ON DELETE CASCADE,
    form_data JSONB NOT NULL,
    generated_body TEXT NOT NULL,
    status letter_status NOT NULL DEFAULT 'pending',
    pdf_storage_path TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letter_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letters ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------
-- RLS POLICIES FOR TABLES
-- ----------------------------------------------------

-- Departments: Anyone authenticated can read
CREATE POLICY "Allow read for authenticated users" ON public.departments
    FOR SELECT TO authenticated USING (true);

-- Department Codes: Anyone authenticated can read
CREATE POLICY "Allow read for authenticated users" ON public.department_codes
    FOR SELECT TO authenticated USING (true);

-- Profiles:
-- 1. Read: Any authenticated user can read profiles (students list faculty, faculty view student info)
CREATE POLICY "Allow read profiles for authenticated" ON public.profiles
    FOR SELECT TO authenticated USING (true);

-- 2. Write/Update: Users can only update their own profile
CREATE POLICY "Allow users to update own profile" ON public.profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Letter Types: Anyone authenticated can read
CREATE POLICY "Allow read letter types for authenticated" ON public.letter_types
    FOR SELECT TO authenticated USING (true);

-- Letters:
-- 1. Read: Student or Faculty of the letter can read
CREATE POLICY "Allow users to read their own or addressed letters" ON public.letters
    FOR SELECT TO authenticated USING (
        auth.uid() = student_id OR auth.uid() = faculty_id
    );

-- 2. Insert: Students can create letters for themselves
CREATE POLICY "Allow students to create letters" ON public.letters
    FOR INSERT TO authenticated WITH CHECK (
        auth.uid() = student_id AND 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'student'::user_role
    );

-- 3. Update: Faculty can update status/rejection, Students can update their own letters if still pending
CREATE POLICY "Allow faculty and student to update letters" ON public.letters
    FOR UPDATE TO authenticated USING (
        auth.uid() = faculty_id OR 
        (auth.uid() = student_id AND status = 'pending'::letter_status)
    );

-- ----------------------------------------------------
-- AUTOMATIC SIGNUP TRIGGER FOR PROFILES
-- ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_email text;
  v_local_part text;
  v_domain text;
  v_branch_code text;
  v_dept_id uuid;
  v_roll_number text;
  v_role text;
  v_full_name text;
BEGIN
  v_email := NEW.email;
  v_domain := split_part(v_email, '@', 2);
  v_role := coalesce(NEW.raw_user_meta_data->>'role', 'student');
  v_full_name := coalesce(NEW.raw_user_meta_data->>'full_name', 'New User');

  IF v_role = 'student' THEN
    -- 1. Validate student domain
    IF lower(v_domain) != 'aits-tpt.edu.in' THEN
      RAISE EXCEPTION 'Students must sign up with a @aits-tpt.edu.in email address.';
    END IF;
    
    v_local_part := split_part(v_email, '@', 1);
    -- 2. Check student email roll number format (e.g. 24AK1A33D8 is 10 chars)
    IF length(v_local_part) != 10 THEN
      RAISE EXCEPTION 'Invalid student email format. Must be a valid 10-character roll number.';
    END IF;
    
    -- 3. Extract branch code (chars at position 7-8, which is index 6 and 7 in javascript, and substring(from 7 for 2) in SQL)
    v_branch_code := substring(v_local_part from 7 for 2);
    v_roll_number := upper(v_local_part);
    
    -- 4. Check branch code mapping
    SELECT department_id INTO v_dept_id FROM public.department_codes WHERE branch_code = v_branch_code;
    IF v_dept_id IS NULL THEN
      RAISE EXCEPTION 'This platform currently only supports AI&ML department students.';
    END IF;
    
    -- Insert student profile (auto-approved)
    INSERT INTO public.profiles (id, role, department_id, full_name, roll_number, is_approved)
    VALUES (NEW.id, 'student', v_dept_id, v_full_name, v_roll_number, true);
    
  ELSIF v_role = 'faculty' THEN
    v_dept_id := (NEW.raw_user_meta_data->>'department_id')::uuid;
    
    -- Insert faculty profile (unapproved by default, requires manual review)
    INSERT INTO public.profiles (id, role, department_id, full_name, designation, esign_storage_path, is_approved)
    VALUES (
      NEW.id, 
      'faculty', 
      v_dept_id, 
      v_full_name, 
      coalesce(NEW.raw_user_meta_data->>'designation', 'Faculty'),
      NEW.raw_user_meta_data->>'esign_storage_path',
      false
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------
-- STORAGE BUCKETS AND RLS POLICIES
-- ----------------------------------------------------

-- Insert buckets if they don't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('signatures', 'signatures', false) 
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('letters', 'letters', false) 
ON CONFLICT (id) DO NOTHING;

-- RLS policies for signatures storage bucket:
-- Only the owner can upload, read, and delete their signature file.
CREATE POLICY "Allow owner full access to their signature" ON storage.objects
    FOR ALL TO authenticated USING (
        bucket_id = 'signatures' AND 
        split_part(name, '/', 1) = auth.uid()::text
    );

-- RLS policies for letters storage bucket:
-- A student can read their PDF, and the assigned faculty can read the PDF.
-- Storage path is formatted as: letters/{letterId}.pdf
CREATE POLICY "Allow student and faculty to read letters" ON storage.objects
    FOR SELECT TO authenticated USING (
        bucket_id = 'letters' AND 
        (EXISTS (
            SELECT 1 FROM public.letters 
            WHERE id::text = split_part(name, '.', 1) 
              AND (student_id = auth.uid() OR faculty_id = auth.uid())
        ))
    );

-- ----------------------------------------------------
-- SEED DATA
-- ----------------------------------------------------

-- Seed department AI&ML
INSERT INTO public.departments (id, name, branch_code)
VALUES ('74889c25-bb35-430c-ab22-0d12759e663a', 'AI&ML', '33')
ON CONFLICT (name) DO UPDATE SET branch_code = EXCLUDED.branch_code;

-- Seed department code
INSERT INTO public.department_codes (branch_code, department_id)
VALUES ('33', '74889c25-bb35-430c-ab22-0d12759e663a')
ON CONFLICT (branch_code) DO UPDATE SET department_id = EXCLUDED.department_id;

-- Seed standard Letter Types
INSERT INTO public.letter_types (id, name, requires_ai, template) VALUES 
('cf2f5209-ef33-4f27-a169-be5a7536d7a4', 'Leave Letter', false, 'Respected {faculty_name},

I, {student_name} ({roll_number}), studying in the AI&ML department, request leave from {start_date} to {end_date} due to the following reason: {reason}.

I will make sure to catch up on any missed classwork and assignments during my absence. I request you to kindly approve my leave.

Thanking you.

Yours obediently,
{student_name}'),

('b717b9b1-ec5b-4375-9614-41d996919245', 'Permission Letter', false, 'Respected {faculty_name},

I, {student_name} ({roll_number}), request permission to attend/participate in the {activity} scheduled on {date} from {start_time} to {end_time} at {venue}.

I request you to kindly grant me permission for the same.

Thanking you.

Yours obediently,
{student_name}'),

('31448ad5-68ff-4fa5-ad85-a7b26e2e5dfb', 'Event Conduct Letter', false, 'Respected {faculty_name},

We, the students of the AI&ML department, request permission to conduct the event "{event_name}" on {date} at {venue}. We expect approximately {expected_participants} participants. The objective of the event is to {event_purpose}.

We will ensure the venue is kept clean and all discipline guidelines are followed. Kindly grant us permission to conduct this event.

Thanking you.

On behalf of the organizing committee,
{student_name}'),

('c60d6219-58d1-419b-a3d8-55447b97a224', 'Property Request Letter', false, 'Respected {faculty_name},

I, {student_name} ({roll_number}), request booking and permission to use the following college property/facility: "{property_name}" on {date} from {start_time} to {end_time} for the purpose of {purpose}.

We promise to handle the equipment/facility with care and return it in the original condition. Kindly approve our request.

Thanking you.

Yours obediently,
{student_name}'),

('71adab4e-a131-4a4b-9ad4-0a37ff553aee', 'Outing Pass', false, 'Respected {faculty_name},

I, {student_name} ({roll_number}), resident of the college hostel, request an outing pass for {date} from {leave_time} to {return_time} to visit {destination} for the following reason: {reason}.

I will ensure to return to the campus on or before the specified time and take full responsibility for my conduct. Kindly issue the outing pass.

Thanking you.

Yours obediently,
{student_name}'),

-- AI-Enabled Custom Letter
('ff9c748c-7ad2-430c-85e7-a9a7a5840d21', 'Custom/Other Letter (AI Assisted)', true, 'Respected {faculty_name},

{ai_generated_body}

Thanking you.

Yours obediently,
{student_name}')
ON CONFLICT (name) DO UPDATE SET 
  requires_ai = EXCLUDED.requires_ai, 
  template = EXCLUDED.template;
