-- ============================================================
-- Points redemption tables
-- Run in Supabase Studio > SQL Editor
-- ============================================================

-- Pending flags: member wants to use points for a session
create table public.points_flags (
  id uuid primary key default gen_random_uuid(),
  wix_member_id text not null,
  service_id text not null,
  session_start text,
  points_amount int not null,
  money_amount numeric(10,2) not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index idx_points_flags_member on public.points_flags (wix_member_id);

-- Ledger: confirmed deductions and refunds
create table public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  wix_member_id text not null,
  points int not null,
  type text not null check (type in ('deduct', 'refund')),
  reason text,
  booking_id text,
  created_at timestamptz not null default now()
);

create index idx_points_ledger_member on public.points_ledger (wix_member_id);

alter table public.points_flags enable row level security;
alter table public.points_ledger enable row level security;
