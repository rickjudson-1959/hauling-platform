import type { SupabaseClient } from '@supabase/supabase-js'

export interface ApplySuccessInput {
  jobId: string
  orgId: string
  eventId: string
  eventType: string
  paymentIntentId: string
  chargeId: string | null
  amountCents: number
  currency: string
}

export interface ApplySuccessResult {
  alreadyProcessed: boolean
  alreadyPaid: boolean
  sendEmail: boolean
  paymentId: string | null
  invoiceId: string | null
  invoiceNumber: string | null
  customerEmail: string | null
  orgName: string | null
  amountDollars: number | null
}

function dollarsFromCents(cents: number): number {
  return Math.round(cents) / 100
}

export async function claimStripeEvent(
  admin: SupabaseClient,
  eventId: string,
  eventType: string,
  orgId: string | null,
  jobId: string | null,
): Promise<boolean> {
  const { data, error } = await admin
    .from('stripe_events')
    .insert({ id: eventId, type: eventType, org_id: orgId, job_id: jobId })
    .select('id')
    .maybeSingle()
  if (error) {
    if (error.code === '23505') return false
    throw error
  }
  return Boolean(data?.id)
}

export async function applyOnsitePaymentFailed(
  admin: SupabaseClient,
  input: {
    jobId: string
    orgId: string
    eventId: string
    paymentIntentId: string
    amountCents: number
    currency: string
  },
): Promise<{ alreadyProcessed: boolean }> {
  const claimed = await claimStripeEvent(
    admin,
    input.eventId,
    'payment_intent.payment_failed',
    input.orgId,
    input.jobId,
  )
  if (!claimed) return { alreadyProcessed: true }

  const { data: job } = await admin
    .from('jobs')
    .select('id, payment_status')
    .eq('id', input.jobId)
    .eq('org_id', input.orgId)
    .maybeSingle()

  if (!job || job.payment_status === 'paid') return { alreadyProcessed: true }

  await admin.from('jobs').update({
    payment_status: 'failed',
    stripe_payment_intent_id: input.paymentIntentId,
  }).eq('id', input.jobId).eq('org_id', input.orgId)

  await admin.from('payments').insert({
    org_id: input.orgId,
    job_id: input.jobId,
    amount: dollarsFromCents(input.amountCents),
    currency: input.currency,
    status: 'failed',
    stripe_payment_intent_id: input.paymentIntentId,
    stripe_event_id: input.eventId,
    source: 'on_site',
  })

  return { alreadyProcessed: false }
}

export async function applyOnsitePaymentSuccess(
  admin: SupabaseClient,
  input: ApplySuccessInput,
): Promise<ApplySuccessResult> {
  const empty: ApplySuccessResult = {
    alreadyProcessed: true,
    alreadyPaid: false,
    sendEmail: false,
    paymentId: null,
    invoiceId: null,
    invoiceNumber: null,
    customerEmail: null,
    orgName: null,
    amountDollars: null,
  }

  const claimed = await claimStripeEvent(
    admin,
    input.eventId,
    input.eventType,
    input.orgId,
    input.jobId,
  )
  if (!claimed) return { ...empty, alreadyProcessed: true }

  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .select('id, org_id, customer_id, status, payment_status, price, tax_amount, quantity, haul_type_id')
    .eq('id', input.jobId)
    .eq('org_id', input.orgId)
    .maybeSingle()
  if (jobErr) throw jobErr
  if (!job) return empty

  if (job.payment_status === 'paid') {
    return { ...empty, alreadyPaid: true, alreadyProcessed: true }
  }

  const amountDollars = dollarsFromCents(input.amountCents)
  const now = new Date().toISOString()

  const { data: payment, error: payErr } = await admin
    .from('payments')
    .insert({
      org_id: input.orgId,
      job_id: input.jobId,
      amount: amountDollars,
      currency: input.currency,
      status: 'succeeded',
      stripe_payment_intent_id: input.paymentIntentId,
      stripe_charge_id: input.chargeId,
      stripe_event_id: input.eventId,
      source: 'on_site',
    })
    .select('id, receipt_emailed_at')
    .maybeSingle()

  if (payErr) {
    if (payErr.code === '23505') {
      return { ...empty, alreadyPaid: true, alreadyProcessed: true }
    }
    throw payErr
  }

  const jobPatch: Record<string, unknown> = {
    payment_status: 'paid',
    stripe_payment_intent_id: input.paymentIntentId,
  }
  if (job.status === 'completed') jobPatch.status = 'invoiced'

  const { error: jobUpErr } = await admin
    .from('jobs')
    .update(jobPatch)
    .eq('id', input.jobId)
    .eq('org_id', input.orgId)
  if (jobUpErr) throw jobUpErr

  const invoice = await upsertPaidInvoice(admin, {
    job,
    orgId: input.orgId,
    amountDollars,
    now,
  })

  const [{ data: customer }, { data: org }] = await Promise.all([
    job.customer_id
      ? admin.from('customers').select('email').eq('id', job.customer_id).eq('org_id', input.orgId).maybeSingle()
      : Promise.resolve({ data: null as { email: string | null } | null }),
    admin.from('orgs').select('name').eq('id', input.orgId).maybeSingle(),
  ])

  return {
    alreadyProcessed: false,
    alreadyPaid: false,
    sendEmail: !payment?.receipt_emailed_at,
    paymentId: payment?.id ?? null,
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    customerEmail: customer?.email ?? null,
    orgName: org?.name ?? null,
    amountDollars,
  }
}

async function upsertPaidInvoice(
  admin: SupabaseClient,
  args: {
    job: {
      id: string
      customer_id: string | null
      price: number | null
      quantity: number | null
      haul_type_id: string | null
    }
    orgId: string
    amountDollars: number
    now: string
  },
): Promise<{ id: string | null; number: string | null }> {
  const { data: existingLine } = await admin
    .from('invoice_line_items')
    .select('invoice_id')
    .eq('job_id', args.job.id)
    .maybeSingle()

  if (existingLine?.invoice_id) {
    const { data: inv } = await admin
      .from('invoices')
      .select('id, invoice_number, status, sent_at')
      .eq('id', existingLine.invoice_id)
      .eq('org_id', args.orgId)
      .maybeSingle()

    if (inv && inv.status !== 'void' && inv.status !== 'paid') {
      await admin.from('invoices').update({
        status: 'paid',
        paid_at: args.now,
        sent_at: inv.sent_at ?? args.now,
      }).eq('id', inv.id).eq('org_id', args.orgId)

      await admin.from('invoice_audit_log').insert({
        org_id: args.orgId,
        invoice_id: inv.id,
        old_status: inv.status,
        new_status: 'paid',
        note: 'Paid on site via card.',
      })
    }
    return { id: inv?.id ?? existingLine.invoice_id, number: inv?.invoice_number ?? null }
  }

  const { data: invoiceNumber, error: numErr } = await admin.rpc('next_invoice_number', {
    p_org_id: args.orgId,
  })
  if (numErr) throw numErr

  let description = 'Haul'
  let unit: string | null = null
  if (args.job.haul_type_id) {
    const { data: haul } = await admin
      .from('haul_types')
      .select('name, unit')
      .eq('id', args.job.haul_type_id)
      .eq('org_id', args.orgId)
      .maybeSingle()
    if (haul) {
      description = haul.name
      unit = haul.unit
    }
  }

  const { data: inv, error: invErr } = await admin
    .from('invoices')
    .insert({
      org_id: args.orgId,
      customer_id: args.job.customer_id,
      invoice_number: invoiceNumber,
      notes: 'Paid on site via card.',
      subtotal: args.job.price ?? args.amountDollars,
      total: args.amountDollars,
      status: 'paid',
      issued_at: args.now,
      sent_at: args.now,
      paid_at: args.now,
    })
    .select('id, invoice_number')
    .single()
  if (invErr) throw invErr

  const { error: lineErr } = await admin.from('invoice_line_items').insert({
    invoice_id: inv.id,
    job_id: args.job.id,
    description,
    quantity: args.job.quantity,
    unit,
    amount: args.amountDollars,
  })
  if (lineErr && lineErr.code !== '23505') throw lineErr

  await admin.from('invoice_audit_log').insert({
    org_id: args.orgId,
    invoice_id: inv.id,
    old_status: null,
    new_status: 'paid',
    note: 'Invoice created and paid on site via card.',
  })

  return { id: inv.id, number: inv.invoice_number }
}

export async function markReceiptEmailed(admin: SupabaseClient, paymentId: string) {
  await admin.from('payments').update({
    receipt_emailed_at: new Date().toISOString(),
  }).eq('id', paymentId)
}

export async function emailReceiptAndInvoiceCopy(args: {
  to: string
  orgName: string
  invoiceNumber: string
  amountLabel: string
  resendKey?: string
  from?: string
}): Promise<boolean> {
  const resendKey = args.resendKey ?? process.env.RESEND_API_KEY
  const from = args.from ?? process.env.RECEIPT_FROM_EMAIL
  if (!resendKey || !from) return false

  const subject = `Receipt and invoice ${args.invoiceNumber}`
  const text = [
    `${args.orgName}`,
    '',
    `Invoice ${args.invoiceNumber} is paid.`,
    `Amount: ${args.amountLabel} CAD`,
    '',
    'This is your receipt and invoice copy for the on-site card payment.',
    'No tip was added.',
  ].join('\n')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject,
      text,
    }),
  })
  return res.ok
}

export function chargeIdFromIntent(latest: unknown): string | null {
  if (typeof latest === 'string' && latest.length > 0) return latest
  if (latest && typeof latest === 'object' && 'id' in latest) {
    const id = (latest as { id?: unknown }).id
    return typeof id === 'string' ? id : null
  }
  return null
}
