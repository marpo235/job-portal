-- SUPABASE_VIDEO_SETUP.sql
-- Creates the video job applications table and storage bucket for the
-- US English video recording project. Run in the Supabase SQL editor.

-- 1. Table
create table if not exists public.video_job_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  age integer not null,
  gender text not null,
  country_of_origin text not null,
  state_of_origin text not null,
  country_of_residence text not null,
  state_of_residence text not null,
  home_studio boolean not null default false,
  accent text,
  video_file_path text,
  video_files jsonb default '[]'::jsonb,
  ip_address text,
  city text,
  region text,
  country text,
  archived integer not null default 0,
  submitted_at timestamptz not null default now()
);

alter table public.video_job_applications enable row level security;

-- Allow anyone (anon) to submit an application, but not read others.
create policy "video_job_applications_insert_anon"
  on public.video_job_applications
  for insert
  to anon
  with check (true);

create policy "video_job_applications_insert_authenticated"
  on public.video_job_applications
  for insert
  to authenticated
  with check (true);

-- Allow authenticated users (admins) to read all rows.
create policy "video_job_applications_select_authenticated"
  on public.video_job_applications
  for select
  to authenticated
  using (true);

-- 2. Storage bucket for applicant videos (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'applicant-video',
  'applicant-video',
  false,
  1073741824, -- 1 GB
  array['video/mp4', 'video/quicktime']
)
on conflict (id) do nothing;

-- Allow anonymous and authenticated uploads into the bucket.
create policy "applicant_video_insert_anon"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'applicant-video');

create policy "applicant_video_insert_authenticated"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'applicant-video');

-- Allow authenticated users (admins) to read files for review.
create policy "applicant_video_select_authenticated"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'applicant-video');
