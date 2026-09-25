-- ============================================================
-- Drop unique title constraint and clear for reimport
-- Run in Supabase Studio > SQL Editor
-- ============================================================

-- Allow same title with different descriptions
drop index if exists idx_topic_library_title;

-- Clear existing data for fresh import
delete from topic_library;
