-- Public view exposing only the safe owner branding columns to anon callers.
-- Eliminates the need for service-role on the customer landing route.

create view public.owner_branding
  with (security_invoker = on)
as
select
  id,
  business_name,
  accent_color,
  cta_text,
  logo_path,
  branding_complete
from public.owners;

grant select on public.owner_branding to anon, authenticated;

-- The view inherits RLS from underlying owners table because of security_invoker.
-- We need an anon-readable policy on owners scoped to the columns the view exposes.
-- Since RLS is row-level not column-level, we add a row-policy that returns the
-- whole row only when branding_complete = true (incomplete owners are hidden anyway).
-- All sensitive columns (auth, email) are NOT in the view's SELECT list.

create policy "anon read complete owner branding"
  on public.owners for select
  to anon
  using (branding_complete = true);
