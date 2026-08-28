-- Add pdf_hash column to letters table if it doesn't already exist
ALTER TABLE public.letters 
ADD COLUMN IF NOT EXISTS pdf_hash TEXT;
