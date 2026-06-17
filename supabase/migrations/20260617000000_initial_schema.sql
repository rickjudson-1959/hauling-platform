create table orgs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz default now()
);

create table memberships (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role    text not null check (role in ('admin','dispatcher','driver')),
  unique (org_id, user_id)
);

create table haul_types (
  id     uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name   text not null,
  unit   text not null check (unit in ('gallons','loads','tons','cubic_yards','hours'))
);

create table customers (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references orgs(id) on delete cascade,
  name            text not null,
  contact_name    text,
  phone           text,
  email           text,
  billing_address text,
  notes           text,
  created_at      timestamptz default now()
);

create table trucks (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  label        text not null,
  haul_type_id uuid references haul_types(id),
  capacity     numeric,
  status       text not null default 'available'
    check (status in ('available','in_use','maintenance','out_of_service'))
);

create table jobs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  customer_id   uuid references customers(id),
  haul_type_id  uuid references haul_types(id),
  truck_id      uuid references trucks(id),
  driver_id     uuid references memberships(id),
  site_address  text,
  scheduled_for timestamptz,
  quantity      numeric,
  price         numeric,
  status        text not null default 'scheduled'
    check (status in ('scheduled','assigned','en_route','on_site','completed','invoiced','cancelled')),
  notes         text,
  photo_url     text,
  signature_url text,
  completed_at  timestamptz,
  created_at    timestamptz default now()
);

create table invoices (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  customer_id uuid references customers(id),
  status      text not null default 'draft'
    check (status in ('draft','sent','paid','void')),
  subtotal    numeric default 0,
  total       numeric default 0,
  issued_at   timestamptz,
  paid_at     timestamptz,
  created_at  timestamptz default now()
);

create table invoice_lines (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  job_id      uuid references jobs(id),
  description text,
  quantity    numeric,
  unit_price  numeric,
  amount      numeric
);

create index on memberships (user_id);
create index on memberships (org_id);
create index on haul_types (org_id);
create index on customers (org_id);
create index on trucks (org_id);
create index on jobs (org_id);
create index on jobs (driver_id);
create index on jobs (status);
create index on jobs (scheduled_for);
create index on invoices (org_id);
create index on invoices (customer_id);
create index on invoice_lines (invoice_id);
create index on invoice_lines (job_id);

alter table orgs          enable row level security;
alter table memberships   enable row level security;
alter table haul_types    enable row level security;
alter table customers     enable row level security;
alter table trucks        enable row level security;
alter table jobs          enable row level security;
alter table invoices      enable row level security;
alter table invoice_lines enable row level security;

create or replace function public.my_org_id()
returns uuid language sql stable security definer set search_path = public
as $func$ select org_id from memberships where user_id = auth.uid() limit 1 $func$;

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public
as $func$ select role from memberships where user_id = auth.uid() limit 1 $func$;

create or replace function public.my_membership_id()
returns uuid language sql stable security definer set search_path = public
as $func$ select id from memberships where user_id = auth.uid() limit 1 $func$;

create policy "members can view their org" on orgs for select using (id = my_org_id());
create policy "admins can update their org" on orgs for update using (id = my_org_id() and my_role() = 'admin');

create policy "org members can view memberships" on memberships for select using (org_id = my_org_id());
create policy "admins can add members" on memberships for insert with check (org_id = my_org_id() and my_role() = 'admin');
create policy "admins can update member roles" on memberships for update using (org_id = my_org_id() and my_role() = 'admin');
create policy "admins can remove members" on memberships for delete using (org_id = my_org_id() and my_role() = 'admin');

create policy "org members can view haul_types" on haul_types for select using (org_id = my_org_id());
create policy "admins can insert haul_types" on haul_types for insert with check (org_id = my_org_id() and my_role() = 'admin');
create policy "admins can update haul_types" on haul_types for update using (org_id = my_org_id() and my_role() = 'admin');
create policy "admins can delete haul_types" on haul_types for delete using (org_id = my_org_id() and my_role() = 'admin');

create policy "org members can view customers" on customers for select using (org_id = my_org_id());
create policy "admins and dispatchers can insert customers" on customers for insert with check (org_id = my_org_id() and my_role() in ('admin','dispatcher'));
create policy "admins and dispatchers can update customers" on customers for update using (org_id = my_org_id() and my_role() in ('admin','dispatcher'));
create policy "admins can delete customers" on customers for delete using (org_id = my_org_id() and my_role() = 'admin');

create policy "org members can view trucks" on trucks for select using (org_id = my_org_id());
create policy "admins can insert trucks" on trucks for insert with check (org_id = my_org_id() and my_role() = 'admin');
create policy "admins can update trucks" on trucks for update using (org_id = my_org_id() and my_role() = 'admin');
create policy "admins can delete trucks" on trucks for delete using (org_id = my_org_id() and my_role() = 'admin');

create policy "admins and dispatchers can view all org jobs" on jobs for select using (org_id = my_org_id() and my_role() in ('admin','dispatcher'));
create policy "drivers can view their assigned jobs" on jobs for select using (driver_id = my_membership_id());
create policy "admins and dispatchers can insert jobs" on jobs for insert with check (org_id = my_org_id() and my_role() in ('admin','dispatcher'));
create policy "admins and dispatchers can update any org job" on jobs for update using (org_id = my_org_id() and my_role() in ('admin','dispatcher'));
create policy "drivers can update their assigned jobs" on jobs for update using (driver_id = my_membership_id());
create policy "admins can delete jobs" on jobs for delete using (org_id = my_org_id() and my_role() = 'admin');

create policy "admins and dispatchers can view invoices" on invoices for select using (org_id = my_org_id() and my_role() in ('admin','dispatcher'));
create policy "admins and dispatchers can insert invoices" on invoices for insert with check (org_id = my_org_id() and my_role() in ('admin','dispatcher'));
create policy "admins and dispatchers can update invoices" on invoices for update using (org_id = my_org_id() and my_role() in ('admin','dispatcher'));
create policy "admins can delete invoices" on invoices for delete using (org_id = my_org_id() and my_role() = 'admin');

create policy "admins and dispatchers can view invoice_lines" on invoice_lines for select using (my_role() in ('admin','dispatcher') and invoice_id in (select id from invoices where org_id = my_org_id()));
create policy "admins and dispatchers can insert invoice_lines" on invoice_lines for insert with check (my_role() in ('admin','dispatcher') and invoice_id in (select id from invoices where org_id = my_org_id()));
create policy "admins and dispatchers can update invoice_lines" on invoice_lines for update using (my_role() in ('admin','dispatcher') and invoice_id in (select id from invoices where org_id = my_org_id()));
create policy "admins can delete invoice_lines" on invoice_lines for delete using (my_role() = 'admin' and invoice_id in (select id from invoices where org_id = my_org_id()));
