-- ============================================================
-- Feedback and usage tracking tables
-- Run in Supabase Studio > SQL Editor
-- ============================================================

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  wix_member_id text not null,
  screen text,
  message text,
  created_at timestamptz not null default now()
);

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  wix_member_id text not null,
  event text not null,
  created_at timestamptz not null default now()
);

-- Index for querying by member or by event type
create index idx_usage_events_member on public.usage_events (wix_member_id);
create index idx_usage_events_event on public.usage_events (event);
create index idx_usage_events_created on public.usage_events (created_at);

alter table public.feedback enable row level security;
alter table public.usage_events enable row level security;
-- No policies = no browser access. Service key bypasses RLS.
