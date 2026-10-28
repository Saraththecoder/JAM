-- Production hardening: lock down client writes, enforce letter state transitions,
-- add audit logging, indexes, and a privacy-minimized verification RPC.

-- ---------------------------------------------------------------------------
-- 1. Explicit HOD flag (do not infer privileges from free-text designations)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_hod BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_hod_is_faculty;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_hod_is_faculty
  CHECK (is_hod = false OR role = 'faculty') NOT VALID;

UPDATE public.profiles
SET is_hod = true
WHERE role = 'faculty'
  AND is_approved = true
  AND (designation ILIKE '%hod%' OR designation ILIKE '%head%');

-- ---------------------------------------------------------------------------
-- 2. Revoke direct client writes. All sensitive mutations go through server
--    routes using the service role after explicit authorization checks.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.letters FROM PUBLIC, anon, authenticated;

-- Column-level security is only effective when the table-level SELECT grant is
-- removed first. Authenticated users may read the profile fields the UI needs,
-- but never esign_storage_path. Anonymous callers use verify_letter() instead.
GRANT SELECT (
  id,
  role,
  department_id,
  full_name,
  roll_number,
  designation,
  is_approved,
  is_hod,
  created_at,
  updated_at
) ON public.profiles TO authenticated;

-- The service role performs all sensitive writes and needs full column access;
-- make the grant explicit so it does not depend on Supabase default privileges.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;
GRANT SELECT ON public.letters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.letters TO service_role;

-- Remove the legacy write policies so the intent is explicit even if a future
-- migration accidentally re-grants table privileges.
DROP POLICY IF EXISTS "Allow users to update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow students to create letters" ON public.letters;
DROP POLICY IF EXISTS "Allow faculty and student to update letters" ON public.letters;
DROP POLICY IF EXISTS "Allow update for reviewers" ON public.letters;
DROP POLICY IF EXISTS "Allow update for reviewers and creators" ON public.letters;

-- Migration 20260825000004 created an anonymous profile-read policy. It must
-- not survive: the verification RPC is the only anonymous profile reader.
DROP POLICY IF EXISTS "Allow read profiles for everyone" ON public.profiles;
DROP POLICY IF EXISTS "Allow read profiles for authenticated" ON public.profiles;

-- Avoid recursive RLS evaluation when reading the caller's department.
CREATE OR REPLACE FUNCTION public.current_department_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_department_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_department_id() TO authenticated;

DROP POLICY IF EXISTS "Allow read profiles in own department" ON public.profiles;
DROP POLICY IF EXISTS "Allow read profiles in own department" ON public.profiles;
CREATE POLICY "Allow read profiles in own department" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR department_id = public.current_department_id()
  );

-- Push subscriptions are written only by the server route after auth checks.
REVOKE ALL ON public.push_subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO service_role;
DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;

-- Signatures and signed PDFs are uploaded/downloaded only by trusted server
-- code, which uses short-lived signed URLs for PDF reads.
DROP POLICY IF EXISTS "Allow owner full access to their signature" ON storage.objects;
DROP POLICY IF EXISTS "Allow student and faculty to read letters" ON storage.objects;

-- ---------------------------------------------------------------------------
-- 3. Audit log (service-role only; survives letter deletion)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.letter_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id UUID REFERENCES public.letters(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.letter_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.letter_audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.letter_audit_log TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Indexes for the queries the application actually runs
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_letters_student_created
  ON public.letters (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_letters_mentor_created
  ON public.letters (mentor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_letters_hod_created
  ON public.letters (hod_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_letters_faculty_created
  ON public.letters (faculty_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_letters_status_created
  ON public.letters (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_department
  ON public.profiles (department_id);
CREATE INDEX IF NOT EXISTS idx_profiles_hod
  ON public.profiles (department_id) WHERE is_hod = true;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_letter_created
  ON public.letter_audit_log (letter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor_created
  ON public.letter_audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action_created
  ON public.letter_audit_log (action, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Structural safeguards
-- ---------------------------------------------------------------------------
ALTER TABLE public.letters
  DROP CONSTRAINT IF EXISTS letters_mentor_not_student;
ALTER TABLE public.letters
  ADD CONSTRAINT letters_mentor_not_student
  CHECK (mentor_id IS NULL OR mentor_id <> student_id) NOT VALID;

ALTER TABLE public.letters
  DROP CONSTRAINT IF EXISTS letters_hod_not_student;
ALTER TABLE public.letters
  ADD CONSTRAINT letters_hod_not_student
  CHECK (hod_id IS NULL OR hod_id <> student_id) NOT VALID;

ALTER TABLE public.letters
  DROP CONSTRAINT IF EXISTS letters_mentor_not_hod;
ALTER TABLE public.letters
  ADD CONSTRAINT letters_mentor_not_hod
  CHECK (mentor_id IS NULL OR hod_id IS NULL OR mentor_id <> hod_id) NOT VALID;

ALTER TABLE public.letters
  DROP CONSTRAINT IF EXISTS letters_faculty_not_student;
ALTER TABLE public.letters
  ADD CONSTRAINT letters_faculty_not_student
  CHECK (faculty_id <> student_id) NOT VALID;

ALTER TABLE public.letters
  DROP CONSTRAINT IF EXISTS letters_pdf_hash_format;
ALTER TABLE public.letters
  ADD CONSTRAINT letters_pdf_hash_format
  CHECK (pdf_hash IS NULL OR pdf_hash ~ '^[0-9a-f]{64}$') NOT VALID;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_letters_updated_at ON public.letters;
CREATE TRIGGER set_letters_updated_at
  BEFORE UPDATE ON public.letters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Legacy rows used the old `pending` status before the two-step workflow was
-- introduced. Convert only rows that have a valid faculty recipient so they
-- become actionable in the current UI. Rows without a valid recipient are left
-- untouched for manual data cleanup.
UPDATE public.letters l
SET status = 'pending_mentor',
    mentor_id = l.faculty_id,
    updated_at = now()
WHERE l.status = 'pending'
  AND l.mentor_id IS NULL
  AND l.faculty_id IS NOT NULL
  AND l.faculty_id <> l.student_id
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = l.faculty_id
      AND p.role = 'faculty'
      AND p.is_approved = true
  );

-- ---------------------------------------------------------------------------
-- 6. Enforce legal letter transitions and required approval artifacts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_letter_write_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending_mentor'::public.letter_status THEN
      RAISE EXCEPTION 'New letters must start in pending_mentor status.';
    END IF;

    IF NEW.student_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = NEW.student_id AND role = 'student'
    ) THEN
      RAISE EXCEPTION 'The letter owner must be a student.';
    END IF;

    IF NEW.mentor_id IS NULL THEN
      RAISE EXCEPTION 'A mentor is required when creating a letter.';
    END IF;

    IF NEW.hod_id IS NOT NULL THEN
      RAISE EXCEPTION 'A letter cannot be assigned to an HOD before mentor review.';
    END IF;

    IF NEW.mentor_id = NEW.student_id THEN
      RAISE EXCEPTION 'A student cannot be their own reviewer.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = NEW.mentor_id
        AND role = 'faculty'
        AND is_approved = true
        AND is_hod = false
    ) THEN
      RAISE EXCEPTION 'The assigned mentor must be an approved, non-HOD faculty member.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles s
      JOIN public.profiles m ON m.id = NEW.mentor_id
      WHERE s.id = NEW.student_id
        AND s.department_id IS NOT NULL
        AND m.department_id = s.department_id
    ) THEN
      RAISE EXCEPTION 'The mentor must belong to the student department.';
    END IF;

    IF NEW.faculty_id <> NEW.mentor_id THEN
      RAISE EXCEPTION 'The initial recipient must be the assigned mentor.';
    END IF;

    IF NEW.mentor_signed_at IS NOT NULL
       OR NEW.hod_signed_at IS NOT NULL
       OR NEW.pdf_storage_path IS NOT NULL
       OR NEW.pdf_hash IS NOT NULL
       OR NEW.rejection_reason IS NOT NULL
       OR NEW.rejection_by IS NOT NULL THEN
      RAISE EXCEPTION 'New letters cannot contain approval or rejection artifacts.';
    END IF;

    RETURN NEW;
  END IF;

  -- Immutable identity fields.
  IF NEW.student_id <> OLD.student_id THEN
    RAISE EXCEPTION 'The student on a letter cannot be changed.';
  END IF;

  IF NEW.mentor_id IS DISTINCT FROM OLD.mentor_id THEN
    RAISE EXCEPTION 'The assigned mentor cannot be changed.';
  END IF;

  IF NEW.letter_type_id <> OLD.letter_type_id THEN
    RAISE EXCEPTION 'The letter type cannot be changed.';
  END IF;

  -- Terminal states are immutable.
  IF OLD.status IN ('approved'::public.letter_status, 'rejected'::public.letter_status)
     AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Approved or rejected letters cannot change status.';
  END IF;

  IF OLD.status = NEW.status THEN
    IF OLD.status IN ('approved'::public.letter_status, 'rejected'::public.letter_status)
       AND (
         NEW.generated_body <> OLD.generated_body
         OR NEW.form_data IS DISTINCT FROM OLD.form_data
         OR NEW.reference_number IS DISTINCT FROM OLD.reference_number
         OR NEW.pdf_storage_path IS DISTINCT FROM OLD.pdf_storage_path
         OR NEW.pdf_hash IS DISTINCT FROM OLD.pdf_hash
         OR NEW.mentor_signed_at IS DISTINCT FROM OLD.mentor_signed_at
         OR NEW.hod_signed_at IS DISTINCT FROM OLD.hod_signed_at
         OR NEW.hod_id IS DISTINCT FROM OLD.hod_id
         OR NEW.faculty_id IS DISTINCT FROM OLD.faculty_id
         OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
         OR NEW.rejection_by IS DISTINCT FROM OLD.rejection_by
       ) THEN
      RAISE EXCEPTION 'Signed or rejected letter content is immutable.';
    END IF;

    IF NEW.status = 'pending_mentor'::public.letter_status
       AND NEW.faculty_id <> NEW.mentor_id THEN
      RAISE EXCEPTION 'The active recipient of a pending-mentor letter must be the mentor.';
    END IF;

    IF NEW.status = 'pending_hod'::public.letter_status
       AND NEW.faculty_id <> NEW.hod_id THEN
      RAISE EXCEPTION 'The active recipient of a pending-HOD letter must be the HOD.';
    END IF;

    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'pending_mentor'::public.letter_status
      AND NEW.status IN ('pending_hod'::public.letter_status, 'approved'::public.letter_status, 'rejected'::public.letter_status))
    OR
    (OLD.status = 'pending_hod'::public.letter_status
      AND NEW.status IN ('approved'::public.letter_status, 'rejected'::public.letter_status))
  ) THEN
    RAISE EXCEPTION 'Illegal letter status transition from % to %.', OLD.status, NEW.status;
  END IF;

  IF OLD.status = 'pending_hod'::public.letter_status
     AND NEW.hod_id IS DISTINCT FROM OLD.hod_id THEN
    RAISE EXCEPTION 'The assigned HOD cannot be changed after forwarding.';
  END IF;

  IF NEW.status = 'pending_hod'::public.letter_status THEN
    IF NEW.hod_id IS NULL THEN
      RAISE EXCEPTION 'An HOD must be assigned before forwarding.';
    END IF;
    IF NEW.mentor_signed_at IS NULL THEN
      RAISE EXCEPTION 'The mentor must sign before forwarding to the HOD.';
    END IF;
    IF NEW.hod_signed_at IS NOT NULL THEN
      RAISE EXCEPTION 'The HOD signature cannot be recorded before final approval.';
    END IF;
    IF NEW.faculty_id <> NEW.hod_id THEN
      RAISE EXCEPTION 'The active recipient must be the HOD after forwarding.';
    END IF;
    IF NEW.hod_id = NEW.mentor_id THEN
      RAISE EXCEPTION 'The mentor and HOD must be different people.';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles h
      JOIN public.profiles s ON s.id = NEW.student_id
      WHERE h.id = NEW.hod_id
        AND h.role = 'faculty'
        AND h.is_approved = true
        AND h.is_hod = true
        AND h.department_id = s.department_id
    ) THEN
      RAISE EXCEPTION 'The assigned HOD must be an approved HOD in the student department.';
    END IF;
  END IF;

  IF NEW.status = 'approved'::public.letter_status THEN
    IF NEW.pdf_storage_path IS NULL OR NEW.pdf_hash IS NULL OR NEW.mentor_signed_at IS NULL THEN
      RAISE EXCEPTION 'Approved letters require a signed PDF and hash.';
    END IF;
    IF NEW.reference_number IS NULL OR btrim(NEW.reference_number) = '' THEN
      RAISE EXCEPTION 'Approved letters require a reference number.';
    END IF;
    IF NEW.pdf_storage_path <> (NEW.id::text || '.pdf') THEN
      RAISE EXCEPTION 'The signed PDF must use the server-generated storage path.';
    END IF;
    IF NEW.pdf_hash !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'The PDF hash must be a lowercase SHA-256 hex digest.';
    END IF;
    IF NEW.hod_id IS NOT NULL THEN
      IF NEW.hod_signed_at IS NULL THEN
        RAISE EXCEPTION 'The assigned HOD must sign before final approval.';
      END IF;
      IF NEW.faculty_id <> NEW.hod_id THEN
        RAISE EXCEPTION 'The active recipient of a fully approved letter must be the HOD.';
      END IF;
      IF NOT EXISTS (
        SELECT 1
        FROM public.profiles h
        JOIN public.profiles s ON s.id = NEW.student_id
        WHERE h.id = NEW.hod_id
          AND h.role = 'faculty'
          AND h.is_approved = true
          AND h.is_hod = true
          AND h.department_id = s.department_id
      ) THEN
        RAISE EXCEPTION 'The approving HOD must be an approved HOD in the student department.';
      END IF;
    ELSE
      IF NEW.hod_signed_at IS NOT NULL THEN
        RAISE EXCEPTION 'A letter without an HOD cannot have an HOD signature.';
      END IF;
      IF NEW.faculty_id <> NEW.mentor_id THEN
        RAISE EXCEPTION 'The active recipient of a mentor-approved letter must be the mentor.';
      END IF;
      IF EXISTS (
        SELECT 1
        FROM public.profiles h
        JOIN public.profiles s ON s.id = NEW.student_id
        WHERE h.role = 'faculty'
          AND h.is_approved = true
          AND h.is_hod = true
          AND h.department_id = s.department_id
          AND h.id <> NEW.mentor_id
      ) THEN
        RAISE EXCEPTION 'A department HOD is configured; this letter must be forwarded for final approval.';
      END IF;
    END IF;
  END IF;

  IF NEW.status = 'rejected'::public.letter_status THEN
    IF NEW.rejection_reason IS NULL
       OR length(btrim(NEW.rejection_reason)) < 3
       OR NEW.rejection_by IS NULL THEN
      RAISE EXCEPTION 'Rejected letters require a meaningful reason and reviewer.';
    END IF;
    IF OLD.status = 'pending_mentor'::public.letter_status
       AND NEW.rejection_by <> OLD.mentor_id THEN
      RAISE EXCEPTION 'Only the assigned mentor can decline a pending-mentor letter.';
    END IF;
    IF OLD.status = 'pending_hod'::public.letter_status
       AND NEW.rejection_by <> OLD.hod_id THEN
      RAISE EXCEPTION 'Only the assigned HOD can decline a pending-HOD letter.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_letter_write_rules ON public.letters;
CREATE TRIGGER enforce_letter_write_rules
  BEFORE INSERT OR UPDATE ON public.letters
  FOR EACH ROW EXECUTE FUNCTION public.enforce_letter_write_rules();

-- ---------------------------------------------------------------------------
-- 7. Harden account provisioning: public signup is disabled. Only the HOD
--    server route (which sets app_metadata.provisioned_by = 'admin') may create
--    accounts. app_metadata cannot be set by an anon-key signUp call.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_local_part TEXT;
  v_domain TEXT;
  v_branch_code TEXT;
  v_dept_id UUID;
  v_roll_number TEXT;
  v_role TEXT;
  v_full_name TEXT;
  v_designation TEXT;
BEGIN
  -- app_metadata is writable only by the service role, unlike user_metadata,
  -- which is client-controlled. This is what makes the marker unforgeable.
  IF NEW.raw_app_meta_data->>'provisioned_by' IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Public signup is disabled. Accounts are provisioned by your department.';
  END IF;

  v_email := lower(coalesce(NEW.email, ''));
  v_domain := split_part(v_email, '@', 2);
  v_role := NEW.raw_user_meta_data->>'role';
  v_full_name := coalesce(NEW.raw_user_meta_data->>'full_name', 'New User');

  IF v_role IS NULL OR v_role NOT IN ('student', 'faculty') THEN
    RAISE EXCEPTION 'Invalid account role.';
  END IF;

  IF lower(v_domain) <> 'aits-tpt.edu.in' THEN
    RAISE EXCEPTION 'Accounts must use an @aits-tpt.edu.in email address.';
  END IF;

  IF v_role = 'student' THEN
    v_local_part := split_part(v_email, '@', 1);

    IF length(v_local_part) <> 10
       OR v_local_part !~* '^[0-9]{2}[a-z]{2}[0-9]{1}[a-z]{1}[0-9]{2}[a-z0-9]{2}$' THEN
      RAISE EXCEPTION 'Invalid student email format. Must be a valid 10-character roll number.';
    END IF;

    v_branch_code := substring(v_local_part from 7 for 2);
    v_roll_number := upper(v_local_part);

    SELECT department_id INTO v_dept_id
    FROM public.department_codes
    WHERE branch_code = v_branch_code;

    IF v_dept_id IS NULL THEN
      RAISE EXCEPTION 'This platform currently only supports configured departments.';
    END IF;

    INSERT INTO public.profiles (id, role, department_id, full_name, roll_number, is_approved)
    VALUES (NEW.id, 'student', v_dept_id, v_full_name, v_roll_number, true);

  ELSE
    v_dept_id := (NEW.raw_user_meta_data->>'department_id')::uuid;
    IF v_dept_id IS NULL THEN
      RAISE EXCEPTION 'Faculty accounts must be assigned to a department.';
    END IF;

    v_designation := coalesce(NEW.raw_user_meta_data->>'designation', 'Faculty');

    INSERT INTO public.profiles (
      id, role, department_id, full_name, designation, esign_storage_path, is_approved, is_hod
    )
    VALUES (
      NEW.id, 'faculty', v_dept_id, v_full_name, v_designation, NULL, false, false
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Privacy-minimized verification RPC. It returns only metadata needed to
--    validate a document; the full body stays in the signed PDF.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_letter(p_letter_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_letter public.letters%ROWTYPE;
  v_result jsonb;
BEGIN
  SELECT * INTO v_letter FROM public.letters WHERE id = p_letter_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF v_letter.status <> 'approved'::public.letter_status THEN
    RETURN jsonb_build_object(
      'found', true,
      'approved', false,
      'status', v_letter.status
    );
  END IF;

  SELECT jsonb_build_object(
    'found', true,
    'approved', true,
    'status', v_letter.status,
    'id', v_letter.id,
    'created_at', v_letter.created_at,
    'reference_number', v_letter.reference_number,
    'mentor_signed_at', v_letter.mentor_signed_at,
    'hod_signed_at', v_letter.hod_signed_at,
    'pdf_hash', v_letter.pdf_hash,
    'letter_types', jsonb_build_object('name', lt.name),
    'student', jsonb_build_object(
      'full_name', sp.full_name,
      'roll_number', sp.roll_number,
      'departments', jsonb_build_object('name', d.name)
    ),
    'mentor', CASE
      WHEN mp.id IS NOT NULL THEN jsonb_build_object('full_name', mp.full_name, 'designation', mp.designation)
      ELSE NULL
    END,
    'hod', CASE
      WHEN hp.id IS NOT NULL THEN jsonb_build_object('full_name', hp.full_name, 'designation', hp.designation)
      ELSE NULL
    END
  ) INTO v_result
  FROM public.letters l
  JOIN public.letter_types lt ON lt.id = l.letter_type_id
  JOIN public.profiles sp ON sp.id = l.student_id
  LEFT JOIN public.departments d ON d.id = sp.department_id
  LEFT JOIN public.profiles mp ON mp.id = l.mentor_id
  LEFT JOIN public.profiles hp ON hp.id = l.hod_id
  WHERE l.id = p_letter_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_letter(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_letter(uuid) TO anon, authenticated;

-- Ask PostgREST to pick up the new column, functions, grants, and constraints.
NOTIFY pgrst, 'reload schema';
