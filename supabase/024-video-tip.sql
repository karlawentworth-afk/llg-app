-- This week's video tip (admin-set, one row)
-- Run in Supabase Studio > SQL Editor

CREATE TABLE IF NOT EXISTS public.video_tip (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  video_url text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  thumbnail_url text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_tip ENABLE ROW LEVEL SECURITY;

-- Seed with empty row
INSERT INTO public.video_tip (id) VALUES (1) ON CONFLICT DO NOTHING;
