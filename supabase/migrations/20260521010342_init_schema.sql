-- Kollab v1 initial schema: enums + owners table

create type video_status as enum ('new', 'saved', 'hidden');
create type video_processing_status as enum ('uploading', 'ready', 'failed');

create table owners (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null default '',
  accent_color text not null default '#111111',
  logo_path text,
  cta_text text,
  branding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger function: auto-create owners row on auth.users insert.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.owners (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS on owners
alter table owners enable row level security;

create policy "owner self read"
  on owners for select
  using (id = auth.uid());

create policy "owner self update"
  on owners for update
  using (id = auth.uid())
  with check (id = auth.uid());
