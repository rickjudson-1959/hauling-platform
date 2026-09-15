export const PAYMENT_CURRENCY = 'cad'
export const MIN_CHARGE_CENTS = 50

export type JobPaymentStatus = 'unpaid' | 'awaiting_payment' | 'paid' | 'failed'

export interface ChargeBreakdown {
  priceDollars: number
  taxDollars: number
  totalDollars: number
  amountCents: number
  showTax: boolean
}

export function toDollars(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Include job.tax_amount only when it is already stored. Never invent a rate. */
export function chargeBreakdown(
  price: number | string | null | undefined,
  taxAmount: number | string | null | undefined,
): ChargeBreakdown | null {
  const priceDollars = toDollars(price)
  if (priceDollars == null || priceDollars <= 0) return null
  const rawTax = toDollars(taxAmount)
  const taxDollars = rawTax != null && rawTax > 0 ? rawTax : 0
  const totalDollars = priceDollars + taxDollars
  const amountCents = Math.round(totalDollars * 100)
  return {
    priceDollars,
    taxDollars,
    totalDollars,
    amountCents,
    showTax: taxDollars > 0,
  }
}

export function formatCad(dollars: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(dollars)
}

export function canShowCollectSection(jobStatus: string, paymentStatus: string): boolean {
  if (jobStatus === 'cancelled') return false
  if (paymentStatus === 'paid') return true
  return jobStatus === 'on_site' || jobStatus === 'completed' || jobStatus === 'invoiced'
}

export function shouldFulfillOnsitePayment(input: {
  alreadyProcessedEvent: boolean
  jobAlreadyPaid: boolean
}): { fulfill: boolean; sendEmail: boolean } {
  if (input.alreadyProcessedEvent || input.jobAlreadyPaid) {
    return { fulfill: false, sendEmail: false }
  }
  return { fulfill: true, sendEmail: true }
}

export function isChargeableCents(amountCents: number): boolean {
  return Number.isInteger(amountCents) && amountCents >= MIN_CHARGE_CENTS
}

/** Vite client key (pk_test only). Fenrir NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY maps here. */
export function clientPublishableKey(
  viteKey: string | undefined,
  serverKey: string | undefined,
): string | null {
  for (const key of [viteKey, serverKey]) {
    if (key && key.startsWith('pk_test_')) return key
  }
  return null
}
