-- ============================================================
-- Update Wix location IDs for all venues
-- Run in Supabase Studio > SQL Editor
-- ============================================================

update public.venues set wix_location_id = '8547771c-494c-4e60-aa2d-f6d6e7e6e4e4'
  where id = 'a0000000-0000-0000-0000-000000000002'; -- Chilli Dip

update public.venues set wix_location_id = '63f33e2d-e1ac-402f-a4a3-c78f6bfe76b1'
  where id = 'a0000000-0000-0000-0000-000000000003'; -- Growing Golf

update public.venues set wix_location_id = '22ad68f6-1d6e-4865-9e2f-dbc6d827a7d1'
  where id = 'a0000000-0000-0000-0000-000000000005'; -- Golf Kingdom
