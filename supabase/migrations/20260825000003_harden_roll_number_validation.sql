-- Update handle_new_user trigger function to enforce strict roll number regex validation for students
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
    -- 2. Check student email roll number format: 10 characters and matches the college regex structure: e.g. 24AK1A33D8
    IF length(v_local_part) != 10 OR v_local_part !~* '^[0-9]{2}[a-z]{2}[0-9]{1}[a-z]{1}[0-9]{2}[a-z0-9]{2}$' THEN
      RAISE EXCEPTION 'Invalid student email format. Must be a valid 10-character roll number conforming to college pattern.';
    END IF;
    
    -- 3. Extract branch code (chars at position 7-8)
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
