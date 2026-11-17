-- SUPABASE_TALENT_SETUP.sql
-- Creates the talent_pool table for the general talent-database page
-- (talent-pool.html) with RLS: anonymous insert allowed, reads/writes
-- restricted to authenticated admin users. Idempotent — safe to re-run.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.talent_pool (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  email text,
  age integer,
  accent text,
  country_of_origin text,
  state_of_origin text,
  country_of_residence text,
  state_of_residence text,
  native_languages text,
  other_languages text,
  project_interests jsonb,
  weekly_hours text,
  device text,
  home_studio boolean,
  comments text,
  ip_address text,
  city text,
  region text,
  country text,
  location_flag text,
  applicant_ref text,
  submitted_at timestamptz default now(),
  archived boolean default false,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.talent_pool enable row level security;

-- Anonymous + authenticated applicants can insert a registration
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'talent_pool'
      and policyname = 'Allow anonymous talent registration'
  ) then
    create policy "Allow anonymous talent registration"
      on public.talent_pool for insert to anon
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'talent_pool'
      and policyname = 'Allow authenticated talent registration'
  ) then
    create policy "Allow authenticated talent registration"
      on public.talent_pool for insert to authenticated
      with check (true);
  end if;

  -- Only authenticated (logged-in allowlisted) admins can read
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'talent_pool'
      and policyname = 'Allow authenticated read talent pool'
  ) then
    create policy "Allow authenticated read talent pool"
      on public.talent_pool for select to authenticated
      using (true);
  end if;

  -- Only authenticated admins can update (edit/archive)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'talent_pool'
      and policyname = 'Allow authenticated update talent pool'
  ) then
    create policy "Allow authenticated update talent pool"
      on public.talent_pool for update to authenticated
      using (true)
      with check (true);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Verification — expect 4 policies listed below
-- ---------------------------------------------------------------------------
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'talent_pool'
order by policyname;
