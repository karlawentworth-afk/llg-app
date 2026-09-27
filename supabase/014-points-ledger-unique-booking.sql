-- ============================================================
-- Make points settlement idempotent at DB level
-- Run in Supabase Studio > SQL Editor
-- ============================================================

-- Only one deduction per booking. The settle function checks this
-- before inserting, but the constraint catches any race condition.
-- booking_id is nullable (refunds may not have one), so the
-- constraint only applies to non-null values.
create unique index if not exists idx_points_ledger_booking_unique
  on public.points_ledger (booking_id)
  where booking_id is not null;
