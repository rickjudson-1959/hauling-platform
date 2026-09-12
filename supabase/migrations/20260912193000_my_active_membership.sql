-- Login and AuthContext used to SELECT memberships (and embed orgs) from the
-- browser. That path treated any null/error as "not active on a team", which
-- locked out users who have a real active membership when RLS, the orgs embed,
-- or maybeSingle() failed.
--
-- my_role() / my_org_id() already ignore inactive rows as SECURITY DEFINER.
-- This RPC returns the caller's active membership in one round trip so the
-- login gate does not depend on a client table SELECT.
--
-- Rick: paste this file in the Hauling Supabase SQL editor
-- (project upeiucqxepcrspjoikyo) before or with the login-fix deploy.
-- Do NOT apply this migration to production from the agent.

create or replace function public.my_active_membership()
returns table(
  role text,
  org_id uuid,
  org_name text
)
language sql
stable
security definer
set search_path = public
as $func$
  select m.role, m.org_id, o.name as org_name
  from public.memberships m
  join public.orgs o on o.id = m.org_id
  where m.user_id = auth.uid()
    and m.active = true
  limit 1
$func$;

revoke all on function public.my_active_membership() from public;
revoke all on function public.my_active_membership() from anon;
grant execute on function public.my_active_membership() to authenticated;
