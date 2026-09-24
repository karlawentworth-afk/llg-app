-- ============================================================
-- Seed: Chilli Dip venue and perks
-- Run in Supabase Studio > SQL Editor
-- ============================================================

insert into public.venues (id, name, town)
values ('a0000000-0000-0000-0000-000000000002', 'Chilli Dip', 'Bolton')
on conflict (id) do nothing;

-- Update wix_location_id once we know it:
-- update public.venues set wix_location_id = '...' where id = 'a0000000-0000-0000-0000-000000000002';

insert into public.venue_perks (venue_id, text, sort_order) values
  ('a0000000-0000-0000-0000-000000000002', '£7.50 off each group coaching session', 1),
  ('a0000000-0000-0000-0000-000000000002', '20% off coaching with Philip Newnes or Darryl Grundy (PGA Professionals) on one-hour lessons, blocks of four, and joint lessons', 2),
  ('a0000000-0000-0000-0000-000000000002', '5% off hardware at Chilli Dip Golf', 3),
  ('a0000000-0000-0000-0000-000000000002', '20% off dining (A La Carte menu) at The Cherry Tree, Monday to Thursday all day', 4),
  ('a0000000-0000-0000-0000-000000000002', '10% off drinks in the bar at The Cherry Tree, Monday to Thursday all day', 5),
  ('a0000000-0000-0000-0000-000000000002', 'Discounts on all LLG golf days, overseas breaks and golf schools', 6),
  ('a0000000-0000-0000-0000-000000000002', 'Waitlist access when group sessions are full', 7);
