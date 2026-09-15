import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { json } from '../_shared/cors.ts'
import {
  applyOnsitePaymentFailed,
  applyOnsitePaymentSuccess,
  chargeIdFromIntent,
  emailReceiptAndInvoiceCopy,
  markReceiptEmailed,
} from '../_shared/apply-onsite-payment.ts'
import {
  applyInvoiceEmailFailed,
  applyInvoiceEmailSuccess,
  applyInvoiceFinalized,
} from '../_shared/apply-invoice-email.ts'
import { Stripe, stripeClient } from '../_shared/stripe.ts'

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const HANDLED_EVENTS = new Set([
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.finalized',
])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200 })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
  if (!webhookSecret) return json({ error: 'STRIPE_WEBHOOK_SECRET is not set' }, 500)

  const signature = req.headers.get('stripe-signature')
  if (!signature) return json({ error: 'Missing stripe-signature' }, 400)

  const rawBody = await req.text()
  const stripe = stripeClient()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return json({ error: `Signature verification failed: ${msg}` }, 400)
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    return json({ received: true, ignored: event.type })
  }

  const admin = adminClient()

  try {
    if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as Stripe.PaymentIntent
      const jobId = intent.metadata?.job_id
      const orgId = intent.metadata?.org_id
      if (!jobId || !orgId) return json({ received: true, ignored: 'missing job or org metadata' })

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
        return json({ received: true, alreadyProcessed: result.alreadyProcessed || result.alreadyPaid })
      }

      const failed = await applyOnsitePaymentFailed(admin, {
        jobId,
        orgId,
        eventId: event.id,
        paymentIntentId: intent.id,
        amountCents: intent.amount,
        currency: intent.currency,
      })
      return json({ received: true, alreadyProcessed: failed.alreadyProcessed })
    }

    // invoice.* events (Path B, invoice-email)
    const invoice = event.data.object as Stripe.Invoice
    const jobId = invoice.metadata?.job_id
    const orgId = invoice.metadata?.org_id
    if (!jobId || !orgId) return json({ received: true, ignored: 'missing job or org metadata' })

    if (event.type === 'invoice.paid') {
      const result = await applyInvoiceEmailSuccess(admin, {
        eventId: event.id,
        eventType: event.type,
        jobId,
        orgId,
        stripeInvoiceId: invoice.id,
        amountPaidCents: invoice.amount_paid,
        currency: invoice.currency,
      })
      return json({ received: true, alreadyProcessed: result.alreadyProcessed || result.alreadyPaid })
    }

    if (event.type === 'invoice.payment_failed') {
      const result = await applyInvoiceEmailFailed(admin, {
        eventId: event.id,
        eventType: event.type,
        jobId,
        orgId,
        stripeInvoiceId: invoice.id,
        amountCents: invoice.amount_due,
        currency: invoice.currency,
      })
      return json({ received: true, alreadyProcessed: result.alreadyProcessed })
    }

    // invoice.finalized
    const result = await applyInvoiceFinalized(admin, {
      eventId: event.id,
      eventType: event.type,
      jobId,
      orgId,
      stripeInvoiceId: invoice.id,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    })
    return json({ received: true, alreadyProcessed: result.alreadyProcessed })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return json({ error: msg }, 500)
  }
})
