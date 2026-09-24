-- ============================================================
-- Add unique constraint for topic upsert
-- Run in Supabase Studio > SQL Editor
-- ============================================================

alter table public.session_topics
  add constraint session_topics_venue_start_unique
  unique (venue_id, start_utc);
