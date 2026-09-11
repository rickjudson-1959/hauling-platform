import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFrom, mockSingle } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockSingle: vi.fn(),
}))

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    org: { id: 'org-1', name: 'Acme Hauling' },
  }),
}))

vi.mock('../../shared/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    functions: { invoke: vi.fn() },
    storage: { from: () => ({ upload: vi.fn(), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  },
}))

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn().mockResolvedValue({}),
}))

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: import('react').ReactNode }) => <div>{children}</div>,
  PaymentElement: () => <div>Payment Element</div>,
  useStripe: () => null,
  useElements: () => null,
}))

import JobDetail from './JobDetail'

function chainJob(data: unknown) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    single: mockSingle.mockResolvedValue({ data }),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  return chain
}

const onSiteJob = {
  id: 'job-1',
  scheduled_for: '2026-09-11T14:00:00.000Z',
  site_address: '12 Quarry Rd',
  status: 'on_site',
  quantity: 4,
  price: 220,
  payment_status: 'unpaid',
  tax_amount: null,
  tax_label: null,
  notes: null,
  photo_url: null,
  signature_url: null,
  org_id: 'org-1',
  customers: { name: 'River Farms' },
  haul_types: { name: 'Water', unit: 'loads' },
  trucks: { label: 'T-1' },
}

describe('JobDetail on-site pay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue(chainJob(onSiteJob))
  })

  function renderDetail() {
    return render(
      <MemoryRouter initialEntries={['/driver/job-1']}>
        <Routes>
          <Route path="/driver/:id" element={<JobDetail />} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('shows Collect payment on an on-site unpaid job', async () => {
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('River Farms')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Collect payment' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeInTheDocument()
  })

  it('shows Paid and hides collect when payment_status is paid', async () => {
    mockFrom.mockReturnValue(chainJob({ ...onSiteJob, payment_status: 'paid' }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('Paid')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Collect payment' })).not.toBeInTheDocument()
  })
})
