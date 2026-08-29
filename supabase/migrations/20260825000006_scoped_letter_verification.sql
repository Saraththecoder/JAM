-- Migration 20260825000006: Replace public letter read policy with scoped verification RPC

-- 1. Drop existing public read policy on public.letters that allowed bulk listing
DROP POLICY IF EXISTS "Allow public read for approved letters" ON public.letters;

-- 2. Create SECURITY DEFINER function returning strictly approved letter verification payload
CREATE OR REPLACE FUNCTION public.verify_letter(p_letter_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', l.id,
    'created_at', l.created_at,
    'generated_body', l.generated_body,
    'status', l.status,
    'reference_number', l.reference_number,
    'mentor_signed_at', l.mentor_signed_at,
    'hod_signed_at', l.hod_signed_at,
    'pdf_hash', l.pdf_hash,
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
  WHERE l.id = p_letter_id AND l.status = 'approved';

  RETURN v_result;
END;
$$;

-- 3. Grant execution permissions on the function to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.verify_letter(uuid) TO anon, authenticated;
