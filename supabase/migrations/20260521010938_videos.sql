-- Videos: the submissions inbox.
-- Inserts happen exclusively server-side via the service-role key
-- (no INSERT policy for anon or authenticated).

create table videos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete cascade,
  qr_code_id text not null references qr_codes(id) on delete restrict,
  storage_path text not null,
  thumbnail_path text,
  mime_type text not null,
  duration_ms integer,
  width integer,
  height integer,
  size_bytes bigint,
  consent_text_snapshot text not null,
  location_label_snapshot text,
  status video_status not null default 'new',
  processing_status video_processing_status not null default 'uploading',
  ip_hash text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index videos_owner_created_idx
  on videos(owner_id, created_at desc)
  where deleted_at is null;

create index videos_owner_status_idx
  on videos(owner_id, status)
  where deleted_at is null;

create index videos_deleted_purge_idx
  on videos(deleted_at)
  where deleted_at is not null;

alter table videos enable row level security;

create policy "videos owner read"
  on videos for select
  using (owner_id = auth.uid() and deleted_at is null);

create policy "videos owner update"
  on videos for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- No INSERT or DELETE policy: server-side service role only.
