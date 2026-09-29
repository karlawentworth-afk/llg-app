-- ============================================================
-- Short description for topic library (used on posters)
-- Run in Supabase Studio > SQL Editor
-- ============================================================

alter table public.topic_library
  add column if not exists short_description text,
  add column if not exists short_description_status text not null default 'draft'
    check (short_description_status in ('draft', 'approved'));

-- short_description: max ~25 words, warm direct UK English, for posters
-- short_description_status: 'draft' until admin approves, then 'approved'
