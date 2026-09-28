-- ============================================================
-- Session cancellation log
-- Run in Supabase Studio > SQL Editor
-- ============================================================

create table public.session_cancellations (
  id uuid primary key default gen_random_uuid(),
  wix_event_id text not null,
  venue_id uuid,
  cancelled_by text not null,
  created_at timestamptz not null default now()
);

create index idx_session_cancellations_venue on public.session_cancellations (venue_id);
alter table public.session_cancellations enable row level security;
