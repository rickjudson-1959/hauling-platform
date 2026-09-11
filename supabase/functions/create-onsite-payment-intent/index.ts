import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CORS, json } from '../_shared/cors.ts'
import { applyOnsitePaymentSuccess, chargeIdFromIntent } from '../_shared/apply-onsite-payment.ts'
import { requireTestPublishableKey, stripeClient } from '../_shared/stripe.ts'

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    return await handle(req)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return json({ error: msg }, 500)
  }
})

async function handle(req: Request) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

  let body: { jobId?: string; amountDollars?: number }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }
  if (!body.jobId) return json({ error: 'jobId is required' }, 400)

  const admin = adminClient()
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: userError } = await admin.auth.getUser(token)
  if (userError || !user) return json({ error: 'Unauthorized' }, 401)

  const { data: mem } = await admin
    .from('memberships')
    .select('id, org_id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!mem) return json({ error: 'Membership not found' }, 403)

  const { data: job } = await admin
    .from('jobs')
    .select('id, org_id, customer_id, driver_id, status, payment_status, price, tax_amount, stripe_payment_intent_id')
    .eq('id', body.jobId)
    .eq('org_id', mem.org_id)
    .maybeSingle()
  if (!job) return json({ error: 'Job not found' }, 404)
  if (mem.role === 'driver' && job.driver_id !== mem.id) {
    return json({ error: 'Not assigned to this job' }, 403)
  }
  if (job.status === 'cancelled') return json({ error: 'Cancelled jobs cannot be collected' }, 400)
  if (job.payment_status === 'paid') return json({ error: 'Job is already paid' }, 409)

  if (typeof body.amountDollars === 'number' && Number.isFinite(body.amountDollars)) {
    if (body.amountDollars <= 0) return json({ error: 'Amount must be greater than zero' }, 400)
    const { error: priceErr } = await admin
      .from('jobs')
      .update({ price: body.amountDollars })
      .eq('id', job.id)
      .eq('org_id', mem.org_id)
    if (priceErr) return json({ error: priceErr.message }, 500)
    job.price = body.amountDollars
  }

  const price = Number(job.price)
  if (!Number.isFinite(price) || price <= 0) {
    return json({ error: 'Set the job amount before collecting payment' }, 400)
  }
  const taxRaw = job.tax_amount == null ? 0 : Number(job.tax_amount)
  const tax = Number.isFinite(taxRaw) && taxRaw > 0 ? taxRaw : 0
  const amountCents = Math.round((price + tax) * 100)
  if (amountCents < 50) return json({ error: 'Amount must be at least $0.50 CAD' }, 400)

  let customerEmail: string | null = null
  if (job.customer_id) {
    const { data: customer } = await admin
      .from('customers')
      .select('email')
      .eq('id', job.customer_id)
      .eq('org_id', mem.org_id)
      .maybeSingle()
    customerEmail = customer?.email ?? null
  }

  const stripe = stripeClient()
  const publishableKey = requireTestPublishableKey()

  if (job.stripe_payment_intent_id) {
    const existing = await stripe.paymentIntents.retrieve(job.stripe_payment_intent_id)
    if (existing.status === 'succeeded') {
      await applyOnsitePaymentSuccess(admin, {
        jobId: job.id,
        orgId: mem.org_id,
        eventId: `retrieve:${existing.id}`,
        eventType: 'payment_intent.succeeded',
        paymentIntentId: existing.id,
        chargeId: chargeIdFromIntent(existing.latest_charge),
        amountCents: existing.amount,
        currency: existing.currency,
      })
      return json({ error: 'Job is already paid' }, 409)
    }
    const reusable = ['requires_payment_method', 'requires_confirmation', 'requires_action']
    if (reusable.includes(existing.status) && existing.amount === amountCents) {
      await admin.from('jobs').update({
        payment_status: 'awaiting_payment',
        stripe_payment_intent_id: existing.id,
      }).eq('id', job.id).eq('org_id', mem.org_id)
      return json({
        clientSecret: existing.client_secret,
        publishableKey,
        paymentIntentId: existing.id,
        amountCents,
        currency: 'cad',
      })
    }
  }

  const createParams: Record<string, unknown> = {
    amount: amountCents,
    currency: 'cad',
    description: `On-site haul payment (${job.id})`,
    metadata: {
      job_id: job.id,
      org_id: mem.org_id,
      source: 'on_site',
    },
    automatic_payment_methods: { enabled: true },
  }
  if (customerEmail) createParams.receipt_email = customerEmail

  const intent = await stripe.paymentIntents.create(createParams, {
    idempotencyKey: `onsite:${job.id}:${amountCents}`,
  })

  await admin.from('jobs').update({
    payment_status: 'awaiting_payment',
    stripe_payment_intent_id: intent.id,
  }).eq('id', job.id).eq('org_id', mem.org_id)

  await admin.from('payments').insert({
    org_id: mem.org_id,
    job_id: job.id,
    amount: (price + tax),
    currency: 'cad',
    status: 'pending',
    stripe_payment_intent_id: intent.id,
    source: 'on_site',
  })

  return json({
    clientSecret: intent.client_secret,
    publishableKey,
    paymentIntentId: intent.id,
    amountCents,
    currency: 'cad',
  })
}
