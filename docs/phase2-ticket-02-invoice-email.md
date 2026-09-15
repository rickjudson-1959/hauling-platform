# Phase 2 Ticket 2: invoice email (Path B)

Test mode only. Dedicated Hauling Stripe TEST account. Do not use Best Sea to Sky Stripe. Do not flip live mode. Recipients are test contacts only (Rick / Shea / explicit test aliases), never a real customer list.

## What Rick runs

1. Paste `supabase/migrations/20260916000000_invoice_email.sql` into the **hauling-platform** Supabase SQL Editor and run it. Agents must not apply production migrations.
2. Deploy the new function:

```
supabase functions deploy create-invoice-email
```

(`create-onsite-payment-intent`, `confirm-onsite-payment`, and the Supabase `stripe-webhook` backup from Ticket 1 already exist and do not need redeploying, but `stripe-webhook` picked up the new invoice handlers in this change, so redeploy it too if it is still in use.)

```
supabase functions deploy stripe-webhook
```

3. In the Hauling Stripe TEST dashboard, add these events to the existing webhook endpoint (`POST https://<vercel-preview-or-prod>/api/stripe/webhook`):

`invoice.paid`, `invoice.payment_failed`, `invoice.finalized`

(in addition to the `payment_intent.succeeded` / `payment_intent.payment_failed` events already registered for Ticket 1).

No new secrets are required. `create-invoice-email` and the webhook reuse the same `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `SUPABASE_SERVICE_ROLE_KEY` from Ticket 1.

## Behaviour

- Trigger: driver taps **Skip for now** on an unpaid job that is `on_site` or `completed` with a CAD amount set. This is the same button as Ticket 1; it now emails an invoice instead of just leaving the job unpaid.
- One Stripe Invoice per job. `jobs.stripe_invoice_id` is the idempotency guard: a job that already has one never gets a second, even on a second Skip or a retried request. The invoice is created, finalized, and sent (hosted pay link, `collection_method: send_invoice`, due on receipt) before the job or payments row is touched, so a duplicate call always finds the guard already set.
- Requires the job's customer to have an email on file. If not, or if the job amount is not set, or the job is already paid or cancelled, `create-invoice-email` returns a clear error and the job stays untouched so the driver can retry Collect payment instead.
- A Stripe Customer is created once per customer record and cached on `customers.stripe_customer_id` so repeat invoices for the same customer do not create duplicate Stripe customers.
- Job moves to `awaiting_payment` once the invoice is created (regardless of whether the send itself succeeds, since the invoice and its hosted link already exist at that point).
- `invoice.paid` webhook marks the job Paid exactly once (idempotent on the real Stripe event id via `stripe_events`, same mechanism as Ticket 1) and best-effort updates the internal office invoice record, same as an on-site payment.
- `invoice.payment_failed` only records the failed attempt. Unlike a one-shot on-site PaymentIntent, the hosted pay link stays valid after a failed attempt, so the job is not flipped to `failed` and the customer can just retry the same link.
- `invoice.finalized` is a defensive backfill of `stripe_invoice_id` / `invoice_hosted_url` in case the synchronous write from `create-invoice-email` did not land; in the normal path this is a no-op since those fields are already set.
- Driver Job Detail shows an **Invoice emailed** card (with a link to the hosted invoice) instead of Collect/Skip once a job is `awaiting_payment` with an invoice attached, so a driver cannot start a second invoice or collect on-site payment on top of an outstanding invoice from this screen.
- Email content (org name in the footer/custom field, haul type, site address and date, amount, due on receipt) is Stripe's own hosted Invoice email, not a separate ESP. No PO / job-reference number is invented; that field is explicitly parked.

## Known gap

Server-side webhook and invoice-creation logic (`server/applyInvoiceEmail.ts`, `supabase/functions/_shared/apply-invoice-email.ts`) has no automated unit tests yet, matching the same pre-existing gap on the Ticket 1 on-site payment path (`applyOnsitePaymentSuccess` / `applyOnsitePaymentFailed`). Client-side behavior (CollectPayment, the invoice-sent UI state) is covered.

## Env vars

See `.env.example`. No changes from Ticket 1.
