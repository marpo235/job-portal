-- SUPABASE_MIGRATION_ACCENT_GEO.sql
-- Adds the accent + region columns to job_applications, adds region to
-- video_job_applications, and closes the anonymous-read leak on
-- job_applications found during the E2E audit.
-- Run in the Supabase SQL editor AFTER SUPABASE_VIDEO_SETUP.sql.

-- 1. New columns
alter table public.job_applications
  add column if not exists accent text;

alter table public.job_applications
  add column if not exists region text;

alter table public.video_job_applications
  add column if not exists region text;

-- 2. SECURITY FIX — anonymous users were able to SELECT every applicant row
-- (names, emails, IPs). Drop any SELECT policy on job_applications that is
-- granted to the anon role; authenticated (admin) reads are unaffected.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'job_applications'
      and cmd = 'SELECT'
      and ('anon' = any(roles) or 'public' = any(roles))
  loop
    execute format('drop policy %I on public.job_applications', p.policyname);
  end loop;
end $$;

-- Same for the audio bucket: anonymous SELECT on storage.objects would let
-- anyone download applicant audio. Admins use the authenticated role.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd = 'SELECT'
      and ('anon' = any(roles) or 'public' = any(roles))
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

-- Ensure authenticated admins can still read applicant rows.
create policy "job_applications_select_authenticated"
  on public.job_applications
  for select
  to authenticated
  using (true);

-- Ensure authenticated admins can still read applicant audio files.
create policy "applicant_audio_select_authenticated"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'applicant-audio');
