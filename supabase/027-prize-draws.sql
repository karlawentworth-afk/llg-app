-- Prize draw table and seed data
-- Run in Supabase Studio > SQL Editor

CREATE TABLE IF NOT EXISTS public.prize_draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL UNIQUE,
  prize text NOT NULL DEFAULT '',
  draw_at timestamptz,
  winner_contact_id text,
  winner_display text,
  video_path text,
  video_url text,
  poster_path text,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prize_draws_month ON public.prize_draws (month DESC);
ALTER TABLE public.prize_draws ENABLE ROW LEVEL SECURITY;

-- Create storage bucket for uploaded videos (private)
-- NOTE: run this separately in Supabase Dashboard > Storage > New bucket
-- Name: prize-draw-videos, Private, Max 300MB

-- Seed past winners
INSERT INTO prize_draws (month, prize, winner_display, video_url, published) VALUES
  ('2025-12-01', 'Two dozen Callaway golf balls', 'Jill K.', NULL, true),
  ('2026-01-01', '£100 Golfbreaks voucher', 'Helen R.', 'https://www.instagram.com/p/DTxB_e1iOPa/', true),
  ('2026-02-01', '£100 TravisMathew voucher', 'Gerry W.', 'https://www.instagram.com/p/DVOwQ5lCBK1/', true),
  ('2026-03-01', '£100 Callaway voucher and a half-hour lesson', 'Kim M.', 'https://www.instagram.com/p/DWkGMD6oKfg/', true),
  ('2026-04-01', 'Weekend away at Ramside Hall', 'Jody D.', 'https://www.instagram.com/p/DXxTpAloVXE/', true),
  ('2026-05-01', '£100 Golfbreaks voucher', 'Anna C.', 'https://www.instagram.com/p/DZUOXQ_I_yx/', true),
  ('2026-06-01', '£100 OGIO voucher', 'Amanda G.', 'https://www.instagram.com/p/Dac9FvXoFvg/', true),
  ('2026-07-01', '£100 Golfbreaks voucher', 'Denise H.', 'https://www.instagram.com/p/Db34HPDRQxi/', true),
  ('2026-08-01', 'Callaway goodies', 'Fiona C.', 'https://www.instagram.com/ladies_love_golf/reel/Ddj9wP5RSkI/', true),
  ('2026-09-01', 'Three-night break to Portugal', 'Della S.', 'https://www.instagram.com/ladies_love_golf/reel/DeL-i79xu4o/', true)
ON CONFLICT (month) DO NOTHING;
