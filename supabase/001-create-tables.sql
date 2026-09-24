-- ============================================================
-- LLG App: Supabase tables
-- Run this in Supabase Studio > SQL Editor
-- ============================================================

-- 1. venues
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  wix_location_id text,
  town text,
  created_at timestamptz not null default now()
);

-- 2. venue_perks
create table public.venue_perks (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  text text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3. session_topics
create table public.session_topics (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  start_utc timestamptz not null,
  wix_event_id text,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

-- Composite index for matching by venue + start time
create index idx_session_topics_venue_start
  on public.session_topics (venue_id, start_utc);

-- 4. member_prefs
create table public.member_prefs (
  wix_member_id text primary key,
  home_venue_id uuid references public.venues(id) on delete set null,
  always_use_points boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- RLS: no browser access. Only the service key can read/write.
-- ============================================================

alter table public.venues enable row level security;
alter table public.venue_perks enable row level security;
alter table public.session_topics enable row level security;
alter table public.member_prefs enable row level security;

-- No policies = no access via anon or authenticated roles.
-- The service key (service_role) bypasses RLS entirely.
-- This means: browser clients get zero access, Netlify functions
-- using the service key get full access.
