import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { json } from '../_shared/cors.ts'
import {
  applyOnsitePaymentFailed,
  applyOnsitePaymentSuccess,
  chargeIdFromIntent,
  emailReceiptAndInvoiceCopy,
  markReceiptEmailed,
} from '../_shared/apply-onsite-payment.ts'
import { Stripe, stripeClient } from '../_shared/stripe.ts'

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

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

  if (event.type !== 'payment_intent.succeeded' && event.type !== 'payment_intent.payment_failed') {
    return json({ received: true, ignored: event.type })
  }

  const intent = event.data.object as Stripe.PaymentIntent
  const jobId = intent.metadata?.job_id
  const orgId = intent.metadata?.org_id
  if (!jobId || !orgId) {
    return json({ received: true, ignored: 'missing job or org metadata' })
  }

  const admin = adminClient()

  try {
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return json({ error: msg }, 500)
  }
})
