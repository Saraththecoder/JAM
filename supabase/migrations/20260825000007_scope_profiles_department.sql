-- Migration 20260825000007: Scope profile SELECT policy to caller's own department

-- 1. Drop existing open authenticated read policy on public.profiles
DROP POLICY IF EXISTS "Allow read profiles for authenticated" ON public.profiles;

-- 2. Create department-scoped read policy for authenticated users
CREATE POLICY "Allow read profiles in own department" ON public.profiles
    FOR SELECT TO authenticated
    USING (
        department_id = (SELECT department_id FROM public.profiles WHERE id = auth.uid())
    );
