import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { claimStripeEvent, upsertPaidInvoice } from './apply-onsite-payment.ts'
import type { Stripe } from './stripe.ts'

function dollarsFromCents(cents: number): number {
  return Math.round(cents) / 100
}

export interface CreateInvoiceEmailResult {
  ok: boolean
  error?: string
  alreadySent?: boolean
  stripeInvoiceId?: string | null
  hostedInvoiceUrl?: string | null
}

/**
 * Path B: job was skipped or left unpaid after the on-site collect
 * opportunity. Create one Stripe Invoice (hosted pay link) per job and email
 * it to the customer on file. Idempotent on job_id: once jobs.stripe_invoice_id
 * is set, a second call (second Skip, retry) returns the existing invoice
 * instead of creating or sending anything new.
 */
export async function createInvoiceEmail(
  stripe: Stripe,
  admin: SupabaseClient,
  input: { jobId: string; orgId: string },
): Promise<CreateInvoiceEmailResult> {
  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .select(
      'id, org_id, customer_id, status, payment_status, price, tax_amount, quantity, haul_type_id, site_address, scheduled_for, stripe_invoice_id, invoice_hosted_url',
    )
    .eq('id', input.jobId)
    .eq('org_id', input.orgId)
    .maybeSingle()
  if (jobErr) throw jobErr
  if (!job) return { ok: false, error: 'Job not found' }

  if (job.payment_status === 'paid') {
    return { ok: false, error: 'Job is already paid' }
  }
  if (job.status === 'cancelled') {
    return { ok: false, error: 'Cancelled jobs cannot be invoiced' }
  }

  if (job.stripe_invoice_id) {
    return {
      ok: true,
      alreadySent: true,
      stripeInvoiceId: job.stripe_invoice_id,
      hostedInvoiceUrl: job.invoice_hosted_url,
    }
  }

  const price = Number(job.price)
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, error: 'Set the job amount before sending an invoice' }
  }
  const taxRaw = job.tax_amount == null ? 0 : Number(job.tax_amount)
  const tax = Number.isFinite(taxRaw) && taxRaw > 0 ? taxRaw : 0
  const amountCents = Math.round((price + tax) * 100)
  if (amountCents < 50) return { ok: false, error: 'Amount must be at least $0.50 CAD' }

  if (!job.customer_id) {
    return { ok: false, error: 'Job has no customer on file. Cannot send an invoice.' }
  }
  const { data: customer } = await admin
    .from('customers')
    .select('id, name, email, stripe_customer_id')
    .eq('id', job.customer_id)
    .eq('org_id', input.orgId)
    .maybeSingle()
  if (!customer?.email) {
    return { ok: false, error: 'Customer has no email on file. Cannot send an invoice.' }
  }

  const { data: org } = await admin.from('orgs').select('name').eq('id', input.orgId).maybeSingle()
  const orgName = org?.name ?? 'Hauling'

  let haulName = 'Haul'
  if (job.haul_type_id) {
    const { data: haul } = await admin
      .from('haul_types')
      .select('name')
      .eq('id', job.haul_type_id)
      .eq('org_id', input.orgId)
      .maybeSingle()
    if (haul?.name) haulName = haul.name
  }
  const jobDate = job.scheduled_for
    ? new Date(job.scheduled_for).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
    : null
  const jobRef = [job.site_address, jobDate].filter(Boolean).join(', ')
  const description = jobRef ? `${haulName} for ${jobRef}` : haulName

  let stripeCustomerId = customer.stripe_customer_id
  if (!stripeCustomerId) {
    const created = await stripe.customers.create(
      { email: customer.email, name: customer.name, metadata: { org_id: input.orgId, customer_id: customer.id } },
      { idempotencyKey: `customer:${customer.id}` },
    )
    stripeCustomerId = created.id
    await admin
      .from('customers')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('id', customer.id)
      .eq('org_id', input.orgId)
  }

  await stripe.invoiceItems.create(
    {
      customer: stripeCustomerId,
      amount: amountCents,
      currency: 'cad',
      description,
    },
    { idempotencyKey: `invoice-item:${job.id}` },
  )

  const draft = await stripe.invoices.create(
    {
      customer: stripeCustomerId,
      collection_method: 'send_invoice',
      days_until_due: 0,
      auto_advance: false,
      description,
      footer: `Thank you for choosing ${orgName}.`,
      custom_fields: [{ name: 'Organization', value: orgName.slice(0, 30) }],
      metadata: { job_id: job.id, org_id: input.orgId, source: 'invoice_email' },
    },
    { idempotencyKey: `invoice:${job.id}` },
  )

  const finalized = await stripe.invoices.finalizeInvoice(draft.id)

  // Commit the idempotency guard as soon as the invoice exists, before the
  // send call below. Once stripe_invoice_id is set, this job never gets a
  // second invoice, even if the send fails or Skip is pressed again.
  const { error: jobUpErr } = await admin
    .from('jobs')
    .update({
      payment_status: 'awaiting_payment',
      stripe_invoice_id: finalized.id,
      invoice_hosted_url: finalized.hosted_invoice_url ?? null,
    })
    .eq('id', job.id)
    .eq('org_id', input.orgId)
  if (jobUpErr) throw jobUpErr

  await admin.from('payments').insert({
    org_id: input.orgId,
    job_id: job.id,
    amount: dollarsFromCents(amountCents),
    currency: 'cad',
    status: 'pending',
    stripe_invoice_id: finalized.id,
    source: 'invoice_email',
  })

  try {
    await stripe.invoices.sendInvoice(finalized.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('stripe.invoices.sendInvoice failed after invoice was created', err)
    return {
      ok: false,
      error: `Invoice created but the email could not be sent: ${message}`,
      stripeInvoiceId: finalized.id,
      hostedInvoiceUrl: finalized.hosted_invoice_url ?? null,
    }
  }

  return {
    ok: true,
    stripeInvoiceId: finalized.id,
    hostedInvoiceUrl: finalized.hosted_invoice_url ?? null,
  }
}

export interface ApplyInvoiceEmailSuccessInput {
  eventId: string
  eventType: string
  jobId: string
  orgId: string
  stripeInvoiceId: string
  amountPaidCents: number
  currency: string
}

/** invoice.paid webhook. Idempotent via stripe_events on the real Stripe event id. */
export async function applyInvoiceEmailSuccess(
  admin: SupabaseClient,
  input: ApplyInvoiceEmailSuccessInput,
): Promise<{ alreadyProcessed: boolean; alreadyPaid: boolean }> {
  const claimed = await claimStripeEvent(admin, input.eventId, input.eventType, input.orgId, input.jobId)
  if (!claimed) return { alreadyProcessed: true, alreadyPaid: false }

  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .select('id, org_id, customer_id, status, payment_status, price, quantity, haul_type_id')
    .eq('id', input.jobId)
    .eq('org_id', input.orgId)
    .maybeSingle()
  if (jobErr) throw jobErr
  if (!job) return { alreadyProcessed: true, alreadyPaid: false }
  if (job.payment_status === 'paid') return { alreadyProcessed: true, alreadyPaid: true }

  const amountDollars = dollarsFromCents(input.amountPaidCents)
  const now = new Date().toISOString()

  const { data: updatedPayment, error: payErr } = await admin
    .from('payments')
    .update({ status: 'succeeded', amount: amountDollars, stripe_event_id: input.eventId })
    .eq('stripe_invoice_id', input.stripeInvoiceId)
    .eq('job_id', input.jobId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()
  if (payErr) {
    if (payErr.code === '23505') return { alreadyProcessed: true, alreadyPaid: true }
    throw payErr
  }
  if (!updatedPayment) {
    // No matching pending row (should not happen since create-invoice-email
    // always inserts one). Insert one so the money is still on the books.
    const { error: insertErr } = await admin.from('payments').insert({
      org_id: input.orgId,
      job_id: input.jobId,
      amount: amountDollars,
      currency: input.currency,
      status: 'succeeded',
      stripe_invoice_id: input.stripeInvoiceId,
      stripe_event_id: input.eventId,
      source: 'invoice_email',
    })
    if (insertErr && insertErr.code !== '23505') throw insertErr
  }

  const jobPatch: Record<string, unknown> = { payment_status: 'paid' }
  if (job.status === 'completed') jobPatch.status = 'invoiced'

  const { error: jobUpErr } = await admin
    .from('jobs')
    .update(jobPatch)
    .eq('id', input.jobId)
    .eq('org_id', input.orgId)
  if (jobUpErr) throw jobUpErr

  // Best-effort, same as the on-site path: a broken/missing office invoicing
  // schema must not turn a paid Stripe invoice into an error.
  try {
    await upsertPaidInvoice(admin, {
      job,
      orgId: input.orgId,
      amountDollars,
      now,
    })
  } catch (err) {
    console.error('upsertPaidInvoice failed after successful invoice-email payment', err)
  }

  return { alreadyProcessed: false, alreadyPaid: false }
}

/**
 * invoice.payment_failed. Unlike a one-shot on-site PaymentIntent, the hosted
 * invoice pay link stays valid after a failed attempt, so this only records
 * the failed attempt. It does not flip the job to 'failed' or touch the
 * invoice: the customer can just retry the same link.
 */
export async function applyInvoiceEmailFailed(
  admin: SupabaseClient,
  input: {
    eventId: string
    eventType: string
    jobId: string
    orgId: string
    stripeInvoiceId: string
    amountCents: number
    currency: string
  },
): Promise<{ alreadyProcessed: boolean }> {
  const claimed = await claimStripeEvent(admin, input.eventId, input.eventType, input.orgId, input.jobId)
  if (!claimed) return { alreadyProcessed: true }

  await admin.from('payments').insert({
    org_id: input.orgId,
    job_id: input.jobId,
    amount: dollarsFromCents(input.amountCents),
    currency: input.currency,
    status: 'failed',
    stripe_invoice_id: input.stripeInvoiceId,
    stripe_event_id: input.eventId,
    source: 'invoice_email',
  })

  return { alreadyProcessed: false }
}

/**
 * invoice.finalized. Our own create-invoice-email call already finalizes the
 * invoice synchronously and stores the hosted URL, so this is mostly a
 * defensive backfill in case that write did not land.
 */
export async function applyInvoiceFinalized(
  admin: SupabaseClient,
  input: {
    eventId: string
    eventType: string
    jobId: string
    orgId: string
    stripeInvoiceId: string
    hostedInvoiceUrl: string | null
  },
): Promise<{ alreadyProcessed: boolean }> {
  const claimed = await claimStripeEvent(admin, input.eventId, input.eventType, input.orgId, input.jobId)
  if (!claimed) return { alreadyProcessed: true }

  const { data: job } = await admin
    .from('jobs')
    .select('id, stripe_invoice_id, invoice_hosted_url')
    .eq('id', input.jobId)
    .eq('org_id', input.orgId)
    .maybeSingle()
  if (job && !job.stripe_invoice_id) {
    await admin
      .from('jobs')
      .update({ stripe_invoice_id: input.stripeInvoiceId, invoice_hosted_url: input.hostedInvoiceUrl })
      .eq('id', input.jobId)
      .eq('org_id', input.orgId)
  }

  return { alreadyProcessed: false }
}
