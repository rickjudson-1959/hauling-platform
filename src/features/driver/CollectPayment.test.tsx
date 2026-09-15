import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockInvoke, mockConfirmPayment } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockConfirmPayment: vi.fn(),
}))

vi.mock('../../shared/lib/supabase', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
  },
}))

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn().mockResolvedValue({}),
}))

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: import('react').ReactNode }) => <div>{children}</div>,
  PaymentElement: () => <div data-testid="payment-element">Payment Element</div>,
  useStripe: () => ({ confirmPayment: mockConfirmPayment }),
  useElements: () => ({}),
}))

import CollectPayment from './CollectPayment'

const unpaidJob = {
  id: 'job-1',
  org_id: 'org-1',
  status: 'on_site',
  payment_status: 'unpaid',
  price: 150,
  tax_amount: null,
  tax_label: null,
  stripe_invoice_id: null,
  invoice_hosted_url: null,
}

describe('CollectPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockResolvedValue({
      data: {
        clientSecret: 'pi_test_secret',
        publishableKey: 'pk_test_123',
        paymentIntentId: 'pi_test',
      },
      error: null,
    })
    mockConfirmPayment.mockResolvedValue({
      error: undefined,
      paymentIntent: { id: 'pi_test', status: 'succeeded' },
    })
  })

  it('shows Collect payment and Skip for now without marking paid', async () => {
    render(<CollectPayment job={unpaidJob} onJobReload={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Collect payment' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeInTheDocument()
    expect(screen.queryByText('Paid')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('150')).toBeInTheDocument()
  })

  it('starts Payment Element after Collect payment', async () => {
    const user = userEvent.setup()
    render(<CollectPayment job={unpaidJob} onJobReload={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Collect payment' }))
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('create-onsite-payment-intent', {
        body: { jobId: 'job-1', amountDollars: 150 },
      })
    })
    expect(await screen.findByTestId('payment-element')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pay now' })).toBeInTheDocument()
  })

  it('confirms payment on the server instead of trusting the client alone', async () => {
    const user = userEvent.setup()
    const onJobReload = vi.fn().mockResolvedValue(undefined)
    mockInvoke
      .mockResolvedValueOnce({
        data: {
          clientSecret: 'pi_test_secret',
          publishableKey: 'pk_test_123',
          paymentIntentId: 'pi_test',
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: { status: 'paid' }, error: null })

    render(<CollectPayment job={unpaidJob} onJobReload={onJobReload} />)
    await user.click(screen.getByRole('button', { name: 'Collect payment' }))
    await screen.findByRole('button', { name: 'Pay now' })
    await user.click(screen.getByRole('button', { name: 'Pay now' }))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('confirm-onsite-payment', {
        body: { jobId: 'job-1', paymentIntentId: 'pi_test' },
      })
    })
    expect(onJobReload).toHaveBeenCalled()
  })

  it('shows Paid and no collect button when the job is already paid', () => {
    render(
      <CollectPayment
        job={{ ...unpaidJob, payment_status: 'paid' }}
        onJobReload={vi.fn()}
      />,
    )
    expect(screen.getByText('Paid')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Collect payment' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument()
  })

  it('does not invent tax copy when tax is not on the job', () => {
    render(<CollectPayment job={unpaidJob} onJobReload={vi.fn()} />)
    expect(screen.queryByText(/Tax/)).not.toBeInTheDocument()
    expect(screen.queryByText(/GST/)).not.toBeInTheDocument()
    expect(screen.queryByText(/HST/)).not.toBeInTheDocument()
  })

  it('shows supplied tax_label only', () => {
    render(
      <CollectPayment
        job={{ ...unpaidJob, tax_amount: 7.5, tax_label: 'GST' }}
        onJobReload={vi.fn()}
      />,
    )
    expect(screen.getByText(/GST/)).toBeInTheDocument()
    expect(screen.getByText(/Total/)).toBeInTheDocument()
  })

  it('user-facing copy has no em dashes', () => {
    const { container } = render(<CollectPayment job={unpaidJob} onJobReload={vi.fn()} />)
    expect(container.textContent).not.toMatch(/—/)
  })

  describe('Skip for now (Path B invoice email)', () => {
    it('emails an invoice and reloads the job on success', async () => {
      const user = userEvent.setup()
      const onJobReload = vi.fn().mockResolvedValue(undefined)
      mockInvoke.mockResolvedValue({
        data: { stripeInvoiceId: 'in_test', hostedInvoiceUrl: 'https://pay.stripe.com/in_test', alreadySent: false },
        error: null,
      })

      render(<CollectPayment job={unpaidJob} onJobReload={onJobReload} />)
      await user.click(screen.getByRole('button', { name: 'Skip for now' }))

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('create-invoice-email', {
          body: { jobId: 'job-1' },
        })
      })
      expect(onJobReload).toHaveBeenCalled()
    })

    it('shows a clear error and does not reload when the customer has no email on file', async () => {
      const user = userEvent.setup()
      const onJobReload = vi.fn().mockResolvedValue(undefined)
      mockInvoke.mockResolvedValue({
        data: { error: 'Customer has no email on file. Cannot send an invoice.' },
        error: null,
      })

      render(<CollectPayment job={unpaidJob} onJobReload={onJobReload} />)
      await user.click(screen.getByRole('button', { name: 'Skip for now' }))

      expect(await screen.findByText('Customer has no email on file. Cannot send an invoice.')).toBeInTheDocument()
      expect(onJobReload).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Collect payment' })).toBeInTheDocument()
    })

    it('does not send a second invoice when Skip is pressed again after one was already sent', () => {
      // A second Skip call is idempotent server-side (create-invoice-email
      // returns alreadySent instead of creating a new one), but once the job
      // reloads as awaiting_payment with a stripe_invoice_id, the UI should
      // not offer Collect/Skip at all anymore.
      render(
        <CollectPayment
          job={{
            ...unpaidJob,
            payment_status: 'awaiting_payment',
            stripe_invoice_id: 'in_test',
            invoice_hosted_url: 'https://pay.stripe.com/in_test',
          }}
          onJobReload={vi.fn()}
        />,
      )
      expect(screen.getByText('Invoice emailed')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Skip for now' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Collect payment' })).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'View invoice' })).toHaveAttribute(
        'href',
        'https://pay.stripe.com/in_test',
      )
    })

    it('still offers Collect/Skip when awaiting_payment is from a mid-flight on-site collect, not an invoice', () => {
      render(
        <CollectPayment
          job={{ ...unpaidJob, payment_status: 'awaiting_payment', stripe_invoice_id: null }}
          onJobReload={vi.fn()}
        />,
      )
      expect(screen.queryByText('Invoice emailed')).not.toBeInTheDocument()
    })
  })
})
