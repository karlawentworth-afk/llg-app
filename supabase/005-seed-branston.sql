-- ============================================================
-- Seed: Branston venue and perks
-- Run in Supabase Studio > SQL Editor
-- ============================================================

insert into public.venues (id, name, wix_location_id, town)
values (
  'a0000000-0000-0000-0000-000000000004',
  'Branston',
  'fb35ecc2-1ea2-439c-b778-eafc1702716a',
  'Staffordshire'
)
on conflict (id) do nothing;

insert into public.venue_perks (venue_id, text, sort_order) values
  ('a0000000-0000-0000-0000-000000000004', '£7.50 off each group coaching session', 1),
  ('a0000000-0000-0000-0000-000000000004', '10% off all individual lessons with Rory Haigh', 2),
  ('a0000000-0000-0000-0000-000000000004', '5% off food and drink in the Branston Clubhouse', 3),
  ('a0000000-0000-0000-0000-000000000004', '£12 green fee on the Eagle Course (saving of £8)', 4),
  ('a0000000-0000-0000-0000-000000000004', 'Discounts on all LLG golf days, overseas breaks and golf schools', 5),
  ('a0000000-0000-0000-0000-000000000004', 'Waitlist access when group sessions are full', 6);
