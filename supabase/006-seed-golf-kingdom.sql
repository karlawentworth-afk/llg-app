-- ============================================================
-- Seed: Golf Kingdom venue (perks to be added later)
-- Run in Supabase Studio > SQL Editor
-- ============================================================

insert into public.venues (id, name, town)
values ('a0000000-0000-0000-0000-000000000005', 'Golf Kingdom', 'Rosendale')
on conflict (id) do nothing;

-- Update wix_location_id once we know it:
-- update public.venues set wix_location_id = '...' where id = 'a0000000-0000-0000-0000-000000000005';

-- Perks: add when the poster is ready, e.g.:
-- insert into public.venue_perks (venue_id, text, sort_order) values
--   ('a0000000-0000-0000-0000-000000000005', '...', 1);
