-- ============================================================
-- Seed: The Beeches venue and perks
-- Run this in Supabase Studio > SQL Editor AFTER 001-create-tables.sql
-- ============================================================

insert into public.venues (id, name, wix_location_id, town)
values (
  'a0000000-0000-0000-0000-000000000001',
  'The Beeches',
  '0a312a54-8235-4aad-a56b-2931d5b02a2d',
  'Cheshire'
)
on conflict (id) do nothing;

insert into public.venue_perks (venue_id, text, sort_order) values
  ('a0000000-0000-0000-0000-000000000001', '£7.50 off each group coaching session', 1),
  ('a0000000-0000-0000-0000-000000000001', '10% off food and drink in the Beeches Bistro', 2),
  ('a0000000-0000-0000-0000-000000000001', '10% off regripping with Ben Stanier', 3),
  ('a0000000-0000-0000-0000-000000000001', '£10 off your first 1:1 lesson with Ben Stanier or John Cheetham', 4),
  ('a0000000-0000-0000-0000-000000000001', 'Discounts on all LLG golf days, overseas breaks and golf schools', 5),
  ('a0000000-0000-0000-0000-000000000001', 'Waitlist access when group sessions are full', 6);
