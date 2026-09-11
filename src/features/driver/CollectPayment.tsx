import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { useMemo, useState } from 'react'
import { supabase } from '../../shared/lib/supabase'
import {
  canShowCollectSection,
  chargeBreakdown,
  formatCad,
} from './payment'

const stripePromises = new Map<string, Promise<Stripe | null>>()

function stripePromiseFor(publishableKey: string) {
  let pending = stripePromises.get(publishableKey)
  if (!pending) {
    pending = loadStripe(publishableKey)
    stripePromises.set(publishableKey, pending)
  }
  return pending
}

interface JobPayFields {
  id: string
  org_id: string
  status: string
  payment_status: string
  price: number | null
  tax_amount: number | null
  tax_label: string | null
}

interface Props {
  job: JobPayFields
  onJobReload: () => Promise<void>
}

export default function CollectPayment({ job, onJobReload }: Props) {
  const [amountInput, setAmountInput] = useState(
    job.price != null ? String(job.price) : '',
  )
  const [collecting, setCollecting] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [publishableKey, setPublishableKey] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const paid = job.payment_status === 'paid'
  const breakdown = chargeBreakdown(
    amountInput !== '' ? amountInput : job.price,
    job.tax_amount,
  )

  if (!canShowCollectSection(job.status, job.payment_status)) return null

  async function startCollect() {
    setError(null)
    setSkipped(false)
    if (!breakdown) {
      setError('Enter the job amount before collecting payment.')
      return
    }
    setWorking(true)
    const { data, error: fnError } = await supabase.functions.invoke('create-onsite-payment-intent', {
      body: { jobId: job.id, amountDollars: breakdown.priceDollars },
    })
    setWorking(false)
    if (fnError || data?.error) {
      setError(fnError?.message ?? data?.error ?? 'Could not start payment. Try again.')
      return
    }
    if (!data?.clientSecret || !data?.publishableKey) {
      setError('Card collection is not configured. Ask the office to set the Stripe test keys.')
      return
    }
    setClientSecret(data.clientSecret)
    setPublishableKey(data.publishableKey)
    setPaymentIntentId(data.paymentIntentId ?? null)
    setCollecting(true)
  }

  async function skip() {
    setError(null)
    setCollecting(false)
    setClientSecret(null)
    setPublishableKey(null)
    setPaymentIntentId(null)
    setSkipped(true)
    const { error: skipErr } = await supabase
      .from('jobs')
      .update({ payment_status: 'unpaid' })
      .eq('id', job.id)
      .eq('org_id', job.org_id)
    if (skipErr) setError(skipErr.message)
  }

  if (paid) {
    return (
      <section className="bg-white rounded-xl border border-green-200 p-4 space-y-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Payment</h2>
        <p className="text-lg font-semibold text-green-700">Paid</p>
        {breakdown && (
          <p className="text-sm text-gray-600">{formatCad(breakdown.totalDollars)}</p>
        )}
      </section>
    )
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Payment</h2>

      <label className="block space-y-1">
        <span className="text-xs text-gray-400">Amount</span>
        <div className="flex items-center gap-2">
          <span className="text-base text-gray-500">$</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={amountInput}
            onChange={e => setAmountInput(e.target.value)}
            disabled={collecting || working}
            placeholder="0.00"
            className="flex-1 min-h-14 border border-gray-300 rounded-xl px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          />
          <span className="text-sm text-gray-500 shrink-0">CAD</span>
        </div>
      </label>

      {breakdown?.showTax && (
        <div className="text-sm text-gray-600 space-y-0.5">
          <p>Haul {formatCad(breakdown.priceDollars)}</p>
          <p>{job.tax_label || 'Tax'} {formatCad(breakdown.taxDollars)}</p>
          <p className="font-medium text-gray-900">Total {formatCad(breakdown.totalDollars)}</p>
        </div>
      )}

      {skipped && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Payment skipped. This job is not paid.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </p>
      )}

      {!collecting ? (
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={startCollect}
            disabled={working}
            className="w-full min-h-14 py-4 bg-green-600 active:bg-green-700 text-white text-lg font-semibold rounded-xl disabled:opacity-50"
          >
            {working ? 'Starting…' : 'Collect payment'}
          </button>
          <button
            type="button"
            onClick={skip}
            disabled={working}
            className="w-full min-h-14 py-4 border-2 border-gray-300 rounded-xl text-base font-medium text-gray-700 active:bg-gray-50 disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
      ) : clientSecret && publishableKey ? (
        <Elements
          stripe={stripePromiseFor(publishableKey)}
          options={{ clientSecret, appearance: { theme: 'stripe' } }}
        >
          <PayForm
            jobId={job.id}
            paymentIntentId={paymentIntentId}
            onPaid={onJobReload}
            onCancel={skip}
            onError={message => setError(message)}
          />
        </Elements>
      ) : null}
    </section>
  )
}

function PayForm({
  jobId,
  paymentIntentId,
  onPaid,
  onCancel,
  onError,
}: {
  jobId: string
  paymentIntentId: string | null
  onPaid: () => Promise<void>
  onCancel: () => void
  onError: (message: string | null) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const returnUrl = useMemo(
    () => `${window.location.origin}/driver/${jobId}`,
    [jobId],
  )

  async function pay() {
    if (!stripe || !elements) return
    onError(null)
    setSubmitting(true)
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    })
    if (confirmError) {
      setSubmitting(false)
      onError(confirmError.message || 'Payment failed. Try again or skip.')
      return
    }

    const piId = paymentIntent?.id ?? paymentIntentId
    if (!piId) {
      setSubmitting(false)
      onError('Could not confirm payment. Try again.')
      return
    }

    const { data, error: fnError } = await supabase.functions.invoke('confirm-onsite-payment', {
      body: { jobId, paymentIntentId: piId },
    })
    setSubmitting(false)
    if (fnError || data?.error) {
      onError(fnError?.message ?? data?.error ?? 'Could not confirm payment. Try again.')
      return
    }
    if (data?.status === 'paid') {
      await onPaid()
      return
    }
    if (data?.status === 'failed') {
      onError('Payment failed. Try again or skip.')
      return
    }
    onError('Payment is still processing. Wait a moment and open this job again.')
  }

  return (
    <div className="space-y-3">
      <PaymentElement />
      <button
        type="button"
        onClick={pay}
        disabled={!stripe || submitting}
        className="w-full min-h-14 py-4 bg-green-600 active:bg-green-700 text-white text-lg font-semibold rounded-xl disabled:opacity-50"
      >
        {submitting ? 'Confirming payment…' : 'Pay now'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={submitting}
        className="w-full min-h-12 py-3 text-base font-medium text-gray-600 active:text-gray-900"
      >
        Skip for now
      </button>
    </div>
  )
}
