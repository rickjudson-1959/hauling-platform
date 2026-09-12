-- Matches Karl's live migration `memberships_select_own_row` on
-- project upeiucqxepcrspjoikyo: policy "users can view their own membership"
-- (user_id = auth.uid()). Already present in production.
--
-- Idempotent so rebuilds/new envs get the policy and a second apply is a no-op.
-- Do NOT apply this migration to production from the agent.

do $policy$
begin
  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'memberships'
      and policyname = 'users can view their own membership'
  ) then
    create policy "users can view their own membership"
      on public.memberships
      for select
      using (user_id = auth.uid());
  end if;
end
$policy$;
