-- Add on_course column to videos table
-- Run in Supabase Studio > SQL Editor (only if table already exists)

ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS on_course boolean NOT NULL DEFAULT false;
ALTER TABLE public.videos ALTER COLUMN is_free SET DEFAULT false;
