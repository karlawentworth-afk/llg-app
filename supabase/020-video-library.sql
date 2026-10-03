-- ============================================================
-- Video library tables
-- Run in Supabase Studio > SQL Editor
-- ============================================================

-- Videos: metadata for each video
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  wix_file_id text unique not null,
  title text not null,
  description text,
  category text,
  thumbnail_url text,
  is_free boolean not null default false,
  on_course boolean not null default false,
  sort_order int not null default 0,
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_videos_category on public.videos (category) where active = true;
create index idx_videos_featured on public.videos (featured) where featured = true and active = true;
alter table public.videos enable row level security;

-- Watch progress: per member per video
create table if not exists public.video_progress (
  id uuid primary key default gen_random_uuid(),
  wix_member_id text not null,
  video_id uuid not null references public.videos(id),
  position_seconds int not null default 0,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(wix_member_id, video_id)
);

create index idx_video_progress_member on public.video_progress (wix_member_id);
alter table public.video_progress enable row level security;

-- Featured video of the week (set by admin)
-- Just use videos.featured = true for now, no separate table needed.
