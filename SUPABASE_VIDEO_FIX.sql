-- SUPABASE_VIDEO_FIX.sql
-- Idempotent repair for video_job_applications: missing columns + RLS policies.
-- Safe to run multiple times. Run in the Supabase SQL editor.

-- 1. Ensure all columns exist
alter table public.video_job_applications add column if not exists accent text;
alter table public.video_job_applications add column if not exists region text;
alter table public.video_job_applications add column if not exists archived integer not null default 0;

-- 2. Recreate INSERT policies on the table (anonymous applicants + authenticated)
drop policy if exists "video_job_applications_insert_anon" on public.video_job_applications;
drop policy if exists "video_job_applications_insert_authenticated" on public.video_job_applications;
drop policy if exists "video_job_applications_select_authenticated" on public.video_job_applications;

create policy "video_job_applications_insert_anon"
  on public.video_job_applications for insert to anon
  with check (true);

create policy "video_job_applications_insert_authenticated"
  on public.video_job_applications for insert to authenticated
  with check (true);

create policy "video_job_applications_select_authenticated"
  on public.video_job_applications for select to authenticated
  using (true);

-- 3. Recreate storage policies on the applicant-video bucket
drop policy if exists "applicant_video_insert_anon" on storage.objects;
drop policy if exists "applicant_video_insert_authenticated" on storage.objects;
drop policy if exists "applicant_video_select_authenticated" on storage.objects;

create policy "applicant_video_insert_anon"
  on storage.objects for insert to anon
  with check (bucket_id = 'applicant-video');

create policy "applicant_video_insert_authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'applicant-video');

create policy "applicant_video_select_authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'applicant-video');

-- 4. Also ensure the video table allows updates from authenticated admins
drop policy if exists "video_job_applications_update_authenticated" on public.video_job_applications;

create policy "video_job_applications_update_authenticated"
  on public.video_job_applications for update to authenticated
  using (true) with check (true);

-- 5. Verify — should list 4 table policies + 3 storage policies
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where (schemaname = 'public' and tablename = 'video_job_applications')
   or (schemaname = 'storage' and tablename = 'objects' and policyname like 'applicant_video%')
order by schemaname, tablename, policyname;
