-- Add address column to venues for Google Maps directions
-- Run in Supabase Studio > SQL Editor

ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS address text;

-- Update with venue addresses (Karla to fill in)
-- UPDATE venues SET address = 'Branston Golf Club, Burton Road, Burton-on-Trent DE14 3DP' WHERE name LIKE '%Branston%';
