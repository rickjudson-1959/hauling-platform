# Phase 2 Ticket 1: driver on-site pay (Path A)

Test mode only. Dedicated Hauling Stripe TEST account. Do not use Best Sea to Sky Stripe. Do not flip live mode. Ticket 2 (unpaid invoice email) and Ticket 10 (platform subscription) are out of scope.

Rick has not created the Hauling Stripe TEST account yet. Ship placeholders only. Do not invent or hardcode keys.

## What Rick runs

1. Paste `supabase/migrations/20260911000000_onsite_payments.sql` into the **hauling-platform** Supabase SQL Editor and run it. Agents must not apply production migrations.
2. Set Supabase Edge Function secrets (placeholders; Fenrir supplies real Hauling TEST values later):

```
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_PUBLISHABLE_KEY=pk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

3. Deploy PaymentIntent functions:

```
supabase functions deploy create-onsite-payment-intent
supabase functions deploy confirm-onsite-payment
```

4. On the Vercel Hauling project, set server env (never `VITE_` for secrets):

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_URL=https://<hauling-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

`VITE_STRIPE_PUBLISHABLE_KEY` is the Vite mapping of Fenrir's conceptual `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Publishable `pk_test_` only.

5. In the Hauling Stripe TEST dashboard, register:

`POST https://<vercel-preview-or-prod>/api/stripe/webhook`

Events: `payment_intent.succeeded`, `payment_intent.payment_failed`.

Optional invoice-copy email (Stripe still sends its receipt when the customer has an email):

```
RESEND_API_KEY=re_...
RECEIPT_FROM_EMAIL=Hauling Receipts <receipts@your-domain.com>
```

A Supabase `stripe-webhook` function remains as a backup. Register the Vercel `/api/stripe/webhook` route for Path A.

## Behaviour

- Driver Job Detail shows **Collect payment** on on-site, completed, or invoiced jobs.
- Amount is a per-job CAD PaymentIntent (org or driver). No Product/Price catalogue. Optional `tax_amount` / `tax_label` are used only if already on the job. No tax is invented.
- Payment Element charges CAD in Stripe TEST.
- Paid is recorded only after webhook signature verify and/or server-side PaymentIntent retrieve. Client success is not trusted alone.
- Success is idempotent on Stripe event id (or `retrieve:<pi_id>`) plus one succeeded payments row per job. Receipt + invoice copy email at most once.
- **Skip for now** leaves the job unpaid. No fake paid.

## Env vars

See `.env.example`.
