-- ============================================================
-- Topic library table
-- Run in Supabase Studio > SQL Editor
-- ============================================================

create table public.topic_library (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Unique on title to prevent duplicates
create unique index idx_topic_library_title on public.topic_library (lower(title));

alter table public.topic_library enable row level security;
-- No policies = no browser access. Service key bypasses RLS.
