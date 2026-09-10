import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRpc, mockFrom, mockSignOut } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockSignOut: vi.fn(),
}))

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    org: { id: 'org-1', name: 'Acme Hauling' },
    signOut: mockSignOut,
  }),
}))

vi.mock('../../shared/lib/supabase', () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom,
  },
}))

import DriverJobList from './index'

function chainJobs(data: unknown[]) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    order: vi.fn().mockResolvedValue({ data }),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.gte.mockReturnValue(chain)
  chain.lte.mockReturnValue(chain)
  return chain
}

describe('DriverJobList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mockRpc.mockResolvedValue({ data: 'mem-1' })
    mockFrom.mockReturnValue(chainJobs([]))
  })

  it('shows the empty state and add-to-home-screen hint', async () => {
    render(
      <MemoryRouter>
        <DriverJobList />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No jobs today')).toBeInTheDocument()
    })
    expect(screen.getByText('My Jobs')).toBeInTheDocument()
    expect(screen.getByText('Acme Hauling')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(screen.getByText('Add to Home Screen')).toBeInTheDocument()
  })

  it('lists an assigned job as a large tap target', async () => {
    mockFrom.mockReturnValue(chainJobs([
      {
        id: 'job-1',
        scheduled_for: '2026-09-10T14:00:00.000Z',
        site_address: '12 Quarry Rd',
        status: 'assigned',
        quantity: 4,
        customers: { name: 'River Farms' },
        haul_types: { name: 'Water', unit: 'loads' },
        trucks: { label: 'T-1' },
      },
    ]))

    render(
      <MemoryRouter>
        <DriverJobList />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('River Farms')).toBeInTheDocument()
    })
    expect(screen.getByText('12 Quarry Rd')).toBeInTheDocument()
    expect(screen.getByText('Assigned')).toBeInTheDocument()
    expect(screen.queryByText('No jobs today')).not.toBeInTheDocument()
  })
})
