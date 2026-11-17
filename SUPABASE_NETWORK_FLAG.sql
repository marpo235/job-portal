-- SUPABASE_NETWORK_FLAG.sql
-- Adds isp_org + network_flag columns to all three application tables.
-- The edge function writes these for every table it handles, so all three
-- must have the columns or function-driven inserts will fail.
-- Idempotent — safe to re-run.

alter table public.talent_pool            add column if not exists isp_org text;
alter table public.talent_pool            add column if not exists network_flag text;
alter table public.talent_pool            add column if not exists pm_accepted boolean default false;
alter table public.job_applications       add column if not exists isp_org text;
alter table public.job_applications       add column if not exists network_flag text;
alter table public.video_job_applications add column if not exists isp_org text;
alter table public.video_job_applications add column if not exists network_flag text;

-- Verification — expect 7 rows
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and column_name in ('isp_org', 'network_flag', 'pm_accepted')
  and table_name in ('talent_pool', 'job_applications', 'video_job_applications')
order by table_name, column_name;
