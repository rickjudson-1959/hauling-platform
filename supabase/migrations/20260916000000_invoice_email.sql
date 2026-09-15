-- Phase 2 Ticket 2: invoice email (Path B)
-- Paste this entire file into the hauling-platform Supabase SQL Editor and run it.
-- Bob/agents must not apply this to production. Rick runs it.
-- Test mode only. Dedicated Hauling Stripe TEST account. Do not use Best Sea to Sky Stripe.

begin;

-- One Stripe Invoice per job, at most. stripe_invoice_id is the idempotency
-- guard: create-invoice-email checks this before creating a new invoice.
alter table jobs
  add column if not exists stripe_invoice_id text,
  add column if not exists invoice_hosted_url text;

-- Cache the Stripe Customer id so repeat invoices for the same customer do
-- not create duplicate Stripe customers.
alter table customers
  add column if not exists stripe_customer_id text;

-- payments.source was hard-locked to 'on_site' in the collect-pay migration.
-- Allow the invoice-email path too.
alter table payments drop constraint if exists payments_source_check;
alter table payments add constraint payments_source_check
  check (source in ('on_site', 'invoice_email'));

alter table payments
  add column if not exists stripe_invoice_id text;

create index if not exists payments_stripe_invoice_idx on payments (stripe_invoice_id);

commit;
