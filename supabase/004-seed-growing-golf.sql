-- ============================================================
-- Seed: Growing Golf venue and perks
-- Run in Supabase Studio > SQL Editor
-- ============================================================

insert into public.venues (id, name, town)
values ('a0000000-0000-0000-0000-000000000003', 'Growing Golf', 'Kent')
on conflict (id) do nothing;

-- Update wix_location_id once we know it:
-- update public.venues set wix_location_id = '...' where id = 'a0000000-0000-0000-0000-000000000003';

insert into public.venue_perks (venue_id, text, sort_order) values
  ('a0000000-0000-0000-0000-000000000003', '£7.50 off each group coaching session', 1),
  ('a0000000-0000-0000-0000-000000000003', '£10 off first individual lesson with Mark Trow or Chris Pearson', 2),
  ('a0000000-0000-0000-0000-000000000003', '6 week free leisure pass to Tudor Park', 3),
  ('a0000000-0000-0000-0000-000000000003', 'Member green fee rate at Tudor Park', 4),
  ('a0000000-0000-0000-0000-000000000003', '25% off first term coaching in Junior Academy', 5),
  ('a0000000-0000-0000-0000-000000000003', 'Discounts on all LLG golf days, overseas breaks and golf schools', 6),
  ('a0000000-0000-0000-0000-000000000003', 'Waitlist access when group sessions are full', 7);
