-- Allow the videos table to also hold photos.
-- Existing rows default to 'video' so the new column is non-null safe.

create type media_type as enum ('video', 'photo');

alter table videos
  add column media_type media_type not null default 'video';

-- Photos don't have a duration. The check that duration is between 0 and 31s
-- is currently enforced at the API layer, not the DB, so no constraint changes
-- needed here.
