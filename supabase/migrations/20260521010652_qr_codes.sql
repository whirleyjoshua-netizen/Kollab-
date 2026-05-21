-- QR codes: one default per owner, plus optional per-location codes.

create table qr_codes (
  id text primary key,                    -- nanoid(10)
  owner_id uuid not null references owners(id) on delete cascade,
  location_label text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index one_default_qr_per_owner
  on qr_codes(owner_id)
  where is_default = true and archived_at is null;

create index qr_codes_owner_idx on qr_codes(owner_id);

alter table qr_codes enable row level security;

-- Owner can do anything with their own QR codes.
create policy "qr owner all"
  on qr_codes for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Anonymous customer can read non-archived QRs (needed for branded landing).
create policy "qr anon read"
  on qr_codes for select
  to anon
  using (archived_at is null);
