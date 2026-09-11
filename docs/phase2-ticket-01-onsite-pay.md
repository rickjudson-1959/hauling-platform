# Phase 2 Ticket 1: driver on-site pay (Path A)

Test mode only. Dedicated Hauling Stripe TEST account. Do not use Best Sea to Sky Stripe. Do not flip live mode. Ticket 2 (unpaid invoice email) and Ticket 10 (platform subscription) are out of scope.

## What Rick runs

1. Paste `supabase/migrations/20260911000000_onsite_payments.sql` into the **hauling-platform** Supabase SQL Editor and run it. Agents must not apply production migrations.
2. Set Edge Function secrets (placeholders only here; Fenrir supplies the real Hauling TEST values):

```
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_PUBLISHABLE_KEY=pk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

Optional invoice-copy email (receipt still goes through Stripe `receipt_email` when the customer has an email):

```
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set RECEIPT_FROM_EMAIL="Hauling Receipts <receipts@your-domain.com>"
```

3. Deploy functions:

```
supabase functions deploy create-onsite-payment-intent
supabase functions deploy confirm-onsite-payment
supabase functions deploy stripe-webhook --no-verify-jwt
```

4. In the Hauling Stripe TEST dashboard, add a webhook endpoint:

`https://<hauling-project-ref>.supabase.co/functions/v1/stripe-webhook`

Events: `payment_intent.succeeded`, `payment_intent.payment_failed`.

Put the signing secret in `STRIPE_WEBHOOK_SECRET`.

No Stripe secret belongs in Vercel or any `VITE_` variable. The Payment Element publishable key is read server-side and returned to the signed-in driver.

## Behaviour

- Driver Job Detail shows **Collect payment** on on-site, completed, or invoiced jobs.
- Amount is the job price (org or driver). Optional `tax_amount` / `tax_label` are used only if already on the job. No tax is invented.
- Payment Element charges CAD in Stripe TEST.
- Paid is recorded only after webhook signature verify and/or server-side PaymentIntent retrieve. Client success is not trusted alone.
- Success is idempotent on Stripe event id (or `retrieve:<pi_id>`) plus one succeeded payments row per job. Receipt + invoice copy email at most once.
- **Skip for now** leaves the job unpaid. No fake paid.

## Env vars

See `.env.example`. Required on Supabase functions: `STRIPE_SECRET_KEY` (test), `STRIPE_PUBLISHABLE_KEY` (test), `STRIPE_WEBHOOK_SECRET`. The app already needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
