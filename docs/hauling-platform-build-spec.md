# Local Hauling Platform: Claude Code Build Spec

## Summary
A multi-tenant SaaS for small local hauling companies (water trucks, dump trucks, aggregate, junk, vac trucks, etc.). Modeled on the icans.ai operational spine: dispatch board, jobs, trucks and assets, a driver mobile view, invoicing, and an analytics dashboard. Built generic so any local haul type works, not just one vertical.

**Architecture decision:** multi-tenant. Each hauling company is an Organization (tenant). Operators pay a monthly subscription to use the platform. Everything is org-scoped with row-level security.

## Stack
- Frontend: Vite + React + Tailwind
- Backend/data: Supabase (Postgres, Auth, Row-Level Security, Storage for photos)
- Hosting: Vercel
- Billing: Stripe (platform subscription per org; customer-invoice payment collection is Phase 2)

## Roles
- **Owner/Admin:** full access, billing, settings, manages users and trucks.
- **Dispatcher:** creates and assigns jobs, runs the dispatch board, generates invoices.
- **Driver:** mobile view only. Sees today's assigned jobs, updates status, logs quantity, captures photo and signature.

## Generic haul model
The whole point is that one platform fits any local haul type. Don't hardcode "water." Use a configurable **haul type** and **unit of measure** per org:
- Haul type examples: Water Delivery, Dump/Disposal, Aggregate, Junk Removal, Vac Truck.
- Unit of measure: gallons, loads, tons, cubic yards, hours. Set per haul type.
- A job records quantity in that unit (for example 4,000 gallons, or 3 loads).

## Data model
Every table carries `org_id`. RLS scopes all rows to the caller's org via a memberships table. Mirror the org-scoping convention: all client reads go through an org-scoped query helper, never raw unscoped queries.

```sql
-- Tenancy
create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','dispatcher','driver')),
  unique (org_id, user_id)
);

-- Config
create table haul_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  unit text not null check (unit in ('gallons','loads','tons','cubic_yards','hours'))
);

-- Core
create table customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  email text,
  billing_address text,
  notes text,
  created_at timestamptz default now()
);

create table trucks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  label text not null,
  haul_type_id uuid references haul_types(id),
  capacity numeric,
  status text not null default 'available' check (status in ('available','in_use','maintenance','out_of_service'))
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  customer_id uuid references customers(id),
  haul_type_id uuid references haul_types(id),
  truck_id uuid references trucks(id),
  driver_id uuid references memberships(id),
  site_address text,
  scheduled_for timestamptz,
  quantity numeric,
  price numeric,
  status text not null default 'scheduled'
    check (status in ('scheduled','assigned','en_route','on_site','completed','invoiced','cancelled')),
  notes text,
  photo_url text,
  signature_url text,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  customer_id uuid references customers(id),
  status text not null default 'draft' check (status in ('draft','sent','paid','void')),
  subtotal numeric default 0,
  total numeric default 0,
  issued_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz default now()
);

create table invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  job_id uuid references jobs(id),
  description text,
  quantity numeric,
  unit_price numeric,
  amount numeric
);
```

RLS: enable on every table, policy `org_id in (select org_id from memberships where user_id = auth.uid())`. Drivers additionally restricted to rows where they are the assigned driver on the mobile views.

## Screens

1. **Dispatch board** (dispatcher home): day/week calendar with trucks as columns and jobs as cards. Drag a job onto a truck to assign. Color by status. Filter by haul type.
2. **Jobs:** list + create/edit. Pick customer, haul type, site address, schedule, quantity, price. Assign truck and driver.
3. **Customers:** list + profile with job history and open balance.
4. **Trucks/Assets:** list with status, capacity, current assignment.
5. **Driver mobile view:** today's jobs only. Tap a job to set status (en route, on site, completed), log actual quantity, add a photo, capture a signature, add notes.
6. **Invoicing:** select completed-but-uninvoiced jobs for a customer, generate an invoice, send, take payment (Phase 2 online pay).
7. **Dashboard:** jobs today/this week, revenue, asset utilization (truck hours used), driver completion counts, open invoice total.
8. **Settings:** org profile, users and roles, haul types and units, subscription/billing.

## Billing
Two distinct things, keep them separate:
- **Platform subscription** (Phase 1): each org pays to use the app. Single Stripe plan to start (for example flat monthly). Gate access behind active subscription.
- **Customer invoice collection** (Phase 2): let orgs collect payment from their own customers via a Stripe payment link per invoice. Defer this.

## Phased build plan
**Phase 1 (MVP):**
1. Auth + org signup, create org, invite users with roles.
2. Schema + RLS per the model above.
3. Customers CRUD.
4. Trucks CRUD + haul types config.
5. Jobs CRUD.
6. Dispatch board with assign.
7. Driver mobile view with status updates, photo, signature, quantity.
8. Basic invoicing (generate, mark sent, mark paid manually).
9. Dashboard.
10. Stripe platform subscription + access gating.

**Phase 2:**
- Customer online payment per invoice.
- Route ordering on the dispatch board.
- Recurring jobs (standing weekly hauls).
- Customer portal (request a haul, view invoices).
- Basic reporting export.

## Conventions for Claude Code
- All client queries org-scoped through a single helper. No unscoped reads.
- Audit-log every billing and invoice write (who, what, when).
- Never let a job get invoiced twice. Hard guard on the job status transition to `invoiced`.
- Keep SQL migrations as plain text the operator can paste into the Supabase SQL Editor.
- Mobile-first on the driver view. Big tap targets, works one-handed in a truck.
