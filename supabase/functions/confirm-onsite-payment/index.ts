import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CORS, json } from '../_shared/cors.ts'
import {
  applyOnsitePaymentFailed,
  applyOnsitePaymentSuccess,
  chargeIdFromIntent,
  emailReceiptAndInvoiceCopy,
  markReceiptEmailed,
} from '../_shared/apply-onsite-payment.ts'
import { stripeClient } from '../_shared/stripe.ts'

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

  let body: { jobId?: string; paymentIntentId?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }
  if (!body.jobId || !body.paymentIntentId) {
    return json({ error: 'jobId and paymentIntentId are required' }, 400)
  }

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
    .select('id, org_id, driver_id, payment_status')
    .eq('id', body.jobId)
    .eq('org_id', mem.org_id)
    .maybeSingle()
  if (!job) return json({ error: 'Job not found' }, 404)
  if (mem.role === 'driver' && job.driver_id !== mem.id) {
    return json({ error: 'Not assigned to this job' }, 403)
  }

  const stripe = stripeClient()
  const intent = await stripe.paymentIntents.retrieve(body.paymentIntentId)
  const metaJob = intent.metadata?.job_id
  const metaOrg = intent.metadata?.org_id
  if (metaJob && metaJob !== job.id) return json({ error: 'Payment does not match this job' }, 403)
  if (metaOrg && metaOrg !== mem.org_id) return json({ error: 'Payment does not match this org' }, 403)

  if (intent.status === 'succeeded') {
    const result = await applyOnsitePaymentSuccess(admin, {
      jobId: job.id,
      orgId: mem.org_id,
      eventId: `retrieve:${intent.id}`,
      eventType: 'payment_intent.succeeded',
      paymentIntentId: intent.id,
      chargeId: chargeIdFromIntent(intent.latest_charge),
      amountCents: intent.amount,
      currency: intent.currency,
    })
    if (result.sendEmail && result.paymentId) {
      await sendOnce(admin, result)
    }
    return json({ status: 'paid', alreadyProcessed: result.alreadyProcessed || result.alreadyPaid })
  }

  if (intent.status === 'requires_payment_method' || intent.status === 'canceled') {
    await applyOnsitePaymentFailed(admin, {
      jobId: job.id,
      orgId: mem.org_id,
      eventId: `retrieve-failed:${intent.id}:${intent.status}`,
      paymentIntentId: intent.id,
      amountCents: intent.amount,
      currency: intent.currency,
    })
    return json({ status: 'failed' })
  }

  return json({ status: intent.status })
}

async function sendOnce(
  admin: ReturnType<typeof adminClient>,
  result: {
    paymentId: string | null
    customerEmail: string | null
    orgName: string | null
    invoiceNumber: string | null
    amountDollars: number | null
  },
) {
  if (!result.paymentId) return
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
