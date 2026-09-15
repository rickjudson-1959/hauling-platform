import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CORS, json } from '../_shared/cors.ts'
import { createInvoiceEmail } from '../_shared/apply-invoice-email.ts'
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

  let body: { jobId?: string }
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
    .select('id, driver_id')
    .eq('id', body.jobId)
    .eq('org_id', mem.org_id)
    .maybeSingle()
  if (!job) return json({ error: 'Job not found' }, 404)
  if (mem.role === 'driver' && job.driver_id !== mem.id) {
    return json({ error: 'Not assigned to this job' }, 403)
  }

  const stripe = stripeClient()
  const result = await createInvoiceEmail(stripe, admin, { jobId: body.jobId, orgId: mem.org_id })

  if (!result.ok) return json({ error: result.error }, 400)

  return json({
    alreadySent: result.alreadySent ?? false,
    stripeInvoiceId: result.stripeInvoiceId ?? null,
    hostedInvoiceUrl: result.hostedInvoiceUrl ?? null,
  })
}
