-- Admin points adjustment log
-- Run in Supabase Studio > SQL Editor

CREATE TABLE IF NOT EXISTS public.points_admin_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wix_member_id text NOT NULL,
  member_name text,
  member_email text,
  amount int NOT NULL,
  reason text NOT NULL,
  note text,
  admin_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_points_admin_log_member ON public.points_admin_log (wix_member_id);
ALTER TABLE public.points_admin_log ENABLE ROW LEVEL SECURITY;
