-- Storage buckets for Kollab v1.
-- All buckets are private; access is via signed URLs from server-side code.
-- Bucket IDs and names are intentionally identical (id is the URL-safe slug).

insert into storage.buckets (id, name, public)
values
  ('videos', 'videos', false),
  ('thumbnails', 'thumbnails', false),
  ('logos', 'logos', false)
on conflict (id) do nothing;
