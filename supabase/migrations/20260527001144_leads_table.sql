-- Leads / interest form submissions from the marketing page.
-- Anonymous users can insert (the lead form is public). Only the
-- platform operator reads them via the Supabase dashboard / service role —
-- there's no in-app surface for leads in v1.

create type lead_interest as enum ('restaurant', 'wedding', 'event', 'other');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  business_or_event text,
  interest lead_interest not null default 'other',
  message text,
  source_url text,
  ip_hash text,
  created_at timestamptz not null default now(),
  contacted_at timestamptz
);

create index leads_created_idx on public.leads(created_at desc);
create index leads_interest_idx on public.leads(interest) where contacted_at is null;

alter table public.leads enable row level security;

-- Allow anonymous browsers to insert leads. They cannot read or modify.
create policy "leads anon insert"
  on public.leads for insert
  to anon
  with check (true);

-- Allow the user who's filling out the form (also anon for now) to insert
-- if it was the authenticated path. (Future-proofing for if we add
-- per-platform sign-up.)
create policy "leads authenticated insert"
  on public.leads for insert
  to authenticated
  with check (true);
