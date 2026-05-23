-- Storage RLS for `videos` and `thumbnails` buckets.
-- Customer uploads happen server-side via service-role (no INSERT policy needed).
-- Owners read their own files via signed URLs that bypass RLS,
-- but we also add owner self-read policies for direct dashboard reads.

create policy "owners can read own videos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owners can delete own videos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owners can read own thumbnails"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'thumbnails'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owners can delete own thumbnails"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'thumbnails'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No INSERT or UPDATE policies on these buckets — all writes go through
-- /api/upload/sign and /api/videos finalize via service role.
