-- Replace videos_owner_status_idx with one that also covers processing_status.
-- The inbox query is: SELECT ... FROM videos
--   WHERE owner_id = $1 AND processing_status = 'ready' AND deleted_at IS NULL
--   ORDER BY created_at DESC LIMIT N OFFSET M
-- The existing videos_owner_created_idx handles the ORDER BY; this one
-- covers the WHERE filter selectivity.

drop index if exists videos_owner_status_idx;

create index videos_owner_inbox_idx
  on videos(owner_id, processing_status, status)
  where deleted_at is null;
