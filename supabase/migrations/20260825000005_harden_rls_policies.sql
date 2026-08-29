-- Migration 20260825000005: Harden Row Level Security (RLS) policies
-- 1. Restrict profiles SELECT policy so anonymous users cannot list all user profiles
DROP POLICY IF EXISTS "Allow read profiles for everyone" ON public.profiles;
DROP POLICY IF EXISTS "Allow read profiles for authenticated" ON public.profiles;

CREATE POLICY "Allow read profiles for authenticated" ON public.profiles
    FOR SELECT TO authenticated USING (true);

-- 2. Maintain Column-Level Security for esign_storage_path
REVOKE SELECT (esign_storage_path) ON public.profiles FROM public, anon, authenticated;
GRANT SELECT (esign_storage_path) ON public.profiles TO service_role;
