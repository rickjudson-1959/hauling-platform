-- Soft-deactivate team members without deleting auth.users.
-- Karl confirmed public.memberships is currently ONLY id, org_id, user_id, role.
-- This migration adds active boolean NOT NULL DEFAULT true.
--
-- jobs.driver_id references memberships(id) WITHOUT cascade, so deactivate/remove
-- must null driver_id before a membership row can be deleted.
-- invoice_audit_log.changed_by references auth.users WITHOUT cascade, which is
-- why this flow never hard-deletes Auth accounts.
--
-- Rick: paste this file in the Hauling Supabase SQL editor (project upeiucqxepcrspjoikyo)
-- before deploying the Team UI. Do not apply from a ticket-01 / Stripe branch.

alter table public.memberships
  add column if not exists active boolean not null default true;

create index if not exists memberships_org_id_active_idx
  on public.memberships (org_id, active);

-- Org access helpers ignore inactive memberships so the next request has no org.
create or replace function public.my_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $func$
  select org_id
  from memberships
  where user_id = auth.uid()
    and active = true
  limit 1
$func$;

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $func$
  select role
  from memberships
  where user_id = auth.uid()
    and active = true
  limit 1
$func$;

create or replace function public.my_membership_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $func$
  select id
  from memberships
  where user_id = auth.uid()
    and active = true
  limit 1
$func$;

-- Return type gains active, so drop first.
drop function if exists public.org_members();

create function public.org_members()
returns table(
  membership_id uuid,
  user_id uuid,
  role text,
  email text,
  active boolean
)
language sql
stable
security definer
set search_path = public
as $func$
  select m.id as membership_id, m.user_id, m.role, u.email, m.active
  from memberships m
  join auth.users u on u.id = m.user_id
  where m.org_id = my_org_id()
  order by u.email
$func$;

create or replace function public.org_drivers()
returns table(membership_id uuid, email text)
language sql
stable
security definer
set search_path = public
as $func$
  select m.id as membership_id, u.email
  from memberships m
  join auth.users u on u.id = m.user_id
  where m.org_id = my_org_id()
    and m.role = 'driver'
    and m.active = true
  order by u.email
$func$;

grant execute on function public.org_members() to authenticated;
grant execute on function public.org_drivers() to authenticated;

create or replace function public.assert_not_last_active_admin(p_membership memberships)
returns void
language plpgsql
stable
set search_path = public
as $func$
begin
  if p_membership.role is distinct from 'admin' or p_membership.active is not true then
    return;
  end if;

  if not exists (
    select 1
    from memberships
    where org_id = p_membership.org_id
      and id <> p_membership.id
      and role = 'admin'
      and active = true
  ) then
    raise exception 'Cannot deactivate or remove the last admin on this team'
      using errcode = 'P0001';
  end if;
end
$func$;

-- Open jobs lose the driver. Completed / invoiced / cancelled keep history
-- until the membership row is deleted, then remaining FK refs are cleared.
create or replace function public.unassign_membership_jobs(
  p_membership_id uuid,
  p_org_id uuid,
  p_open_only boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  update jobs
  set driver_id = null
  where driver_id = p_membership_id
    and org_id = p_org_id
    and (
      p_open_only = false
      or status in ('scheduled', 'assigned', 'en_route', 'on_site')
    );
end
$func$;

create or replace function public.memberships_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if TG_OP = 'DELETE' then
    perform public.assert_not_last_active_admin(OLD);
    -- Open jobs first (product rule), then any leftover rows so the
    -- jobs.driver_id FK cannot block the membership delete.
    perform public.unassign_membership_jobs(OLD.id, OLD.org_id, true);
    perform public.unassign_membership_jobs(OLD.id, OLD.org_id, false);
    return OLD;
  end if;

  if TG_OP = 'UPDATE' then
    if OLD.role = 'admin'
       and OLD.active = true
       and (
         NEW.active = false
         or NEW.role is distinct from 'admin'
       ) then
      perform public.assert_not_last_active_admin(OLD);
    end if;

    if NEW.active = false and OLD.active is distinct from false then
      perform public.unassign_membership_jobs(NEW.id, NEW.org_id, true);
    end if;
    return NEW;
  end if;

  return NEW;
end
$func$;

drop trigger if exists memberships_before_write on public.memberships;
create trigger memberships_before_write
  before update or delete on public.memberships
  for each row
  execute function public.memberships_before_write();

-- Admin-only RPCs stay org-scoped and never touch auth.users.
create or replace function public.deactivate_membership(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_org_id uuid := my_org_id();
begin
  if my_role() is distinct from 'admin' then
    raise exception 'Only admins can deactivate team members'
      using errcode = '42501';
  end if;

  update memberships
  set active = false
  where id = p_membership_id
    and org_id = v_org_id;

  if not found then
    raise exception 'Member not found in this organization'
      using errcode = 'P0002';
  end if;
end
$func$;

create or replace function public.reactivate_membership(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_org_id uuid := my_org_id();
begin
  if my_role() is distinct from 'admin' then
    raise exception 'Only admins can reactivate team members'
      using errcode = '42501';
  end if;

  update memberships
  set active = true
  where id = p_membership_id
    and org_id = v_org_id;

  if not found then
    raise exception 'Member not found in this organization'
      using errcode = 'P0002';
  end if;
end
$func$;

create or replace function public.remove_membership(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_org_id uuid := my_org_id();
begin
  if my_role() is distinct from 'admin' then
    raise exception 'Only admins can remove team members'
      using errcode = '42501';
  end if;

  delete from memberships
  where id = p_membership_id
    and org_id = v_org_id;

  if not found then
    raise exception 'Member not found in this organization'
      using errcode = 'P0002';
  end if;
end
$func$;

revoke all on function public.deactivate_membership(uuid) from public;
revoke all on function public.reactivate_membership(uuid) from public;
revoke all on function public.remove_membership(uuid) from public;
revoke all on function public.assert_not_last_active_admin(memberships) from public;
revoke all on function public.unassign_membership_jobs(uuid, uuid, boolean) from public;
revoke all on function public.memberships_before_write() from public;

grant execute on function public.deactivate_membership(uuid) to authenticated;
grant execute on function public.reactivate_membership(uuid) to authenticated;
grant execute on function public.remove_membership(uuid) to authenticated;
