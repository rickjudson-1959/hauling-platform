-- Phase 2 Ticket 1: driver on-site pay (Path A)
-- Paste this entire file into the hauling-platform Supabase SQL Editor and run it.
-- Bob/agents must not apply this to production. Rick runs it.
-- Test mode only. Dedicated Hauling Stripe TEST account. Do not use Best Sea to Sky Stripe.

begin;

-- Job payment fields. tax_amount / tax_label are optional and unused unless already set
-- on a job. This ticket does not invent tax rates or Stripe Tax.
alter table jobs
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists stripe_payment_intent_id text,
  add column if not exists tax_amount numeric,
  add column if not exists tax_label text;

alter table jobs drop constraint if exists jobs_payment_status_check;
alter table jobs add constraint jobs_payment_status_check
  check (payment_status in ('unpaid', 'awaiting_payment', 'paid', 'failed'));

-- Org-scoped payments log (source = on_site for this ticket)
create table if not exists payments (
  id                         uuid primary key default gen_random_uuid(),
  org_id                     uuid not null references orgs(id) on delete cascade,
  job_id                     uuid not null references jobs(id) on delete cascade,
  amount                     numeric not null,
  currency                   text not null default 'cad',
  status                     text not null
    check (status in ('pending', 'succeeded', 'failed', 'canceled')),
  stripe_payment_intent_id   text,
  stripe_charge_id           text,
  stripe_event_id            text unique,
  source                     text not null default 'on_site'
    check (source = 'on_site'),
  receipt_emailed_at         timestamptz,
  created_at                 timestamptz not null default now()
);

create index if not exists payments_org_id_idx on payments (org_id);
create index if not exists payments_job_id_idx on payments (job_id);
create index if not exists payments_stripe_pi_idx on payments (stripe_payment_intent_id);
create unique index if not exists payments_one_succeeded_per_job
  on payments (job_id) where status = 'succeeded';

-- Webhook / retrieve idempotency (Stripe event id, or retrieve:<pi_id>)
create table if not exists stripe_events (
  id         text primary key,
  org_id     uuid references orgs(id) on delete cascade,
  job_id     uuid references jobs(id) on delete set null,
  type       text not null,
  created_at timestamptz not null default now()
);

alter table payments      enable row level security;
alter table stripe_events enable row level security;

drop policy if exists "org members can view payments" on payments;
create policy "org members can view payments"
  on payments for select
  using (org_id = my_org_id());

-- No client writes. Edge functions use the service role.
-- stripe_events stays service-role only (no authenticated policies).

commit;
