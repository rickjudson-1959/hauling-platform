import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import {
  applyOnsitePaymentFailed,
  applyOnsitePaymentSuccess,
  chargeIdFromIntent,
  emailReceiptAndInvoiceCopy,
  markReceiptEmailed,
} from './applyOnsitePayment'
import { applyInvoiceEmailFailed, applyInvoiceEmailSuccess, applyInvoiceFinalized } from './applyInvoiceEmail'
import type { Database } from '../src/shared/types/database'

export function requireTestStripeSecret(key: string | undefined): string {
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  if (key.startsWith('sk_live') || key.startsWith('rk_live')) {
    throw new Error('Live Stripe keys are not allowed. Use the Hauling Stripe TEST secret.')
  }
  if (!key.startsWith('sk_test') && !key.startsWith('rk_test')) {
    throw new Error('STRIPE_SECRET_KEY must be a Hauling Stripe TEST key (sk_test_ or rk_test_).')
  }
  return key
}

export function adminFromEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required on the server')
  }
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const HANDLED_EVENTS = new Set([
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.finalized',
])

export async function handleStripeWebhook(rawBody: string, signature: string | undefined) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not set')
  if (!signature) throw new Error('Missing stripe-signature')

  const stripe = new Stripe(requireTestStripeSecret(process.env.STRIPE_SECRET_KEY))
  const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)

  if (!HANDLED_EVENTS.has(event.type)) {
    return { received: true, ignored: event.type }
  }

  const admin = adminFromEnv()

  if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object
    const jobId = intent.metadata?.job_id
    const orgId = intent.metadata?.org_id
    if (!jobId || !orgId) return { received: true, ignored: 'missing job or org metadata' }

    if (event.type === 'payment_intent.succeeded') {
      const result = await applyOnsitePaymentSuccess(admin, {
        jobId,
        orgId,
        eventId: event.id,
        eventType: event.type,
        paymentIntentId: intent.id,
        chargeId: chargeIdFromIntent(intent.latest_charge),
        amountCents: intent.amount,
        currency: intent.currency,
      })
      if (result.sendEmail && result.paymentId) {
        if (result.customerEmail && result.invoiceNumber && result.amountDollars != null) {
          await emailReceiptAndInvoiceCopy({
            to: result.customerEmail,
            orgName: result.orgName ?? 'Hauling',
            invoiceNumber: result.invoiceNumber,
            amountLabel: result.amountDollars.toFixed(2),
          })
        }
        await markReceiptEmailed(admin, result.paymentId)
      }
      return { received: true, alreadyProcessed: result.alreadyProcessed || result.alreadyPaid }
    }

    const failed = await applyOnsitePaymentFailed(admin, {
      jobId,
      orgId,
      eventId: event.id,
      paymentIntentId: intent.id,
      amountCents: intent.amount,
      currency: intent.currency,
    })
    return { received: true, alreadyProcessed: failed.alreadyProcessed }
  }

  // invoice.* events (Path B, invoice-email). Each branch narrows event.type
  // individually so event.data.object is typed as Stripe.Invoice, not the
  // enormous union of every possible Stripe object.
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object
    const jobId = invoice.metadata?.job_id
    const orgId = invoice.metadata?.org_id
    if (!jobId || !orgId) return { received: true, ignored: 'missing job or org metadata' }

    const result = await applyInvoiceEmailSuccess(admin, {
      eventId: event.id,
      eventType: event.type,
      jobId,
      orgId,
      stripeInvoiceId: invoice.id,
      amountPaidCents: invoice.amount_paid,
      currency: invoice.currency,
    })
    return { received: true, alreadyProcessed: result.alreadyProcessed || result.alreadyPaid }
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object
    const jobId = invoice.metadata?.job_id
    const orgId = invoice.metadata?.org_id
    if (!jobId || !orgId) return { received: true, ignored: 'missing job or org metadata' }

    const result = await applyInvoiceEmailFailed(admin, {
      eventId: event.id,
      eventType: event.type,
      jobId,
      orgId,
      stripeInvoiceId: invoice.id,
      amountCents: invoice.amount_due,
      currency: invoice.currency,
    })
    return { received: true, alreadyProcessed: result.alreadyProcessed }
  }

  if (event.type !== 'invoice.finalized') {
    // Unreachable: HANDLED_EVENTS only lets these five types through.
    return { received: true, ignored: event.type }
  }

  const invoice = event.data.object
  const jobId = invoice.metadata?.job_id
  const orgId = invoice.metadata?.org_id
  if (!jobId || !orgId) return { received: true, ignored: 'missing job or org metadata' }

  const result = await applyInvoiceFinalized(admin, {
    eventId: event.id,
    eventType: event.type,
    jobId,
    orgId,
    stripeInvoiceId: invoice.id,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
  })
  return { received: true, alreadyProcessed: result.alreadyProcessed }
}
