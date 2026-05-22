-- Storage RLS for the `logos` bucket.
-- Each owner can read/write only files under their own user-id-prefixed folder.

-- Allow authenticated owners to upload their logo under logos/{auth.uid()}/...
create policy "owners can write own logo"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated owners to overwrite their own logo.
create policy "owners can update own logo"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow owners to read their own logo (e.g., dashboard preview).
create policy "owners can read own logo"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow owners to delete their own logo.
create policy "owners can delete own logo"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anonymous customers reading via signed URLs do NOT need a policy
-- (signed URLs bypass RLS).
