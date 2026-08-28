-- Fix SELECT policies to allow anonymous users (anon) to read departments, profiles, and letter_types (required for QR code verification page)

-- 1. Departments SELECT policy
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.departments;
CREATE POLICY "Allow read for everyone" ON public.departments
    FOR SELECT TO anon, authenticated USING (true);

-- 2. Department Codes SELECT policy
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.department_codes;
CREATE POLICY "Allow read for everyone" ON public.department_codes
    FOR SELECT TO anon, authenticated USING (true);

-- 3. Profiles SELECT policy
DROP POLICY IF EXISTS "Allow read profiles for authenticated" ON public.profiles;
CREATE POLICY "Allow read profiles for everyone" ON public.profiles
    FOR SELECT TO anon, authenticated USING (true);

-- 4. Letter Types SELECT policy
DROP POLICY IF EXISTS "Allow read letter types for authenticated" ON public.letter_types;
CREATE POLICY "Allow read letter types for everyone" ON public.letter_types
    FOR SELECT TO anon, authenticated USING (true);
