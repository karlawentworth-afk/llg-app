-- ============================================================
-- Venue logo URL and poster footnote
-- Run in Supabase Studio > SQL Editor
-- ============================================================

alter table public.venues
  add column if not exists logo_url text,
  add column if not exists poster_footnote text;

-- logo_url: URL to the venue's logo image (uploaded to Supabase Storage)
-- poster_footnote: optional text shown at the bottom of the monthly poster
--   e.g. "Sessions may move indoors in bad weather"
