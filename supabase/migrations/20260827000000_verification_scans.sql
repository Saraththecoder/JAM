-- Create verification_scans table to track audit checks
CREATE TABLE IF NOT EXISTS public.verification_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    letter_id UUID NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
    scanned_at TIMESTAMPTZ DEFAULT now(),
    ip_address TEXT,
    user_agent TEXT
);

-- Enable RLS
ALTER TABLE public.verification_scans ENABLE ROW LEVEL SECURITY;

-- Allow select and insert for public verification routes
CREATE POLICY "Allow public insert for scans" ON public.verification_scans
    FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow read for participants and verification node" ON public.verification_scans
    FOR SELECT TO anon, authenticated USING (true);
