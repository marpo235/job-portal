-- 1. Create the Applications Table
CREATE TABLE IF NOT EXISTS public.job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    audio_file_path TEXT NOT NULL,
    ip_address TEXT,
    city TEXT,
    country TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS) on Database Table
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Policy: Allow ANY public user (anon) to INSERT records
CREATE POLICY "Allow public insert to job_applications"
ON public.job_applications
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Explicitly DO NOT create a SELECT/READ policy for anon.
-- This ensures applicants cannot fetch or read other applicants' data.


-- 3. Create Private Storage Bucket for Audio Files
INSERT INTO storage.buckets (id, name, public)
VALUES ('applicant-audio', 'applicant-audio', false)
ON CONFLICT (id) DO NOTHING;

-- 4. Enable RLS Policy on Storage Objects for Uploads
CREATE POLICY "Allow public audio upload"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'applicant-audio');

-- Explicitly DO NOT create a SELECT policy on storage.objects.
-- Audio files remain private and only downloadable by you via the Supabase Admin Dashboard.
