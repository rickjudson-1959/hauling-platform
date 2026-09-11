import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockInvoke, mockFromUpdate, mockConfirmPayment } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockFromUpdate: vi.fn(),
  mockConfirmPayment: vi.fn(),
}))

vi.mock('../../shared/lib/supabase', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
    from: () => {
      const chain = {
        update: mockFromUpdate,
        eq: vi.fn(),
      }
      mockFromUpdate.mockReturnValue(chain)
      chain.eq.mockReturnValue(chain)
      Object.assign(chain, { then: (resolve: (v: { error: null }) => void) => resolve({ error: null }) })
      return chain
    },
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
    const user = userEvent.setup()
    const onJobReload = vi.fn().mockResolvedValue(undefined)
    render(<CollectPayment job={unpaidJob} onJobReload={onJobReload} />)

    expect(screen.getByRole('button', { name: 'Collect payment' })).toBeInTheDocument()
    expect(screen.queryByText('Paid')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('150')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Skip for now' }))
    expect(await screen.findByText('Payment skipped. This job is not paid.')).toBeInTheDocument()
    expect(screen.queryByText('Paid')).not.toBeInTheDocument()
    expect(onJobReload).not.toHaveBeenCalled()
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
})
