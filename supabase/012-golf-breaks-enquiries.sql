-- ============================================================
-- Golf Breaks enquiry log
-- Run in Supabase Studio > SQL Editor
-- ============================================================

create table public.golf_breaks_enquiries (
  id uuid primary key default gen_random_uuid(),
  wix_member_id text not null,
  name text,
  email text not null,
  phone text,
  destination text,
  travel_date text,
  dates_flexible boolean default false,
  party_size text,
  nights text,
  rounds text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.golf_breaks_enquiries enable row level security;
