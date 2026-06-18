-- Run once in Supabase dashboard: SQL Editor → paste → Run
-- Required by /api/cron/homeowner-blast and /api/homeowner-blast/import

create table if not exists homeowner_blast_list (
  id bigint generated always as identity primary key,
  name text,
  email text not null unique,
  zip text,
  city text,
  status text not null default 'pending', -- pending | sent | unsubscribed | bounced
  sent_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_homeowner_blast_status on homeowner_blast_list(status);
