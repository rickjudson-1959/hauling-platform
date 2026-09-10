import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockOrgQuery, mockRpc, mockSignOut } = vi.hoisted(() => ({
  mockOrgQuery: vi.fn(),
  mockRpc: vi.fn(),
  mockSignOut: vi.fn(),
}))

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    org: { id: 'org-1', name: 'Acme Hauling' },
    signOut: mockSignOut,
  }),
}))

vi.mock('../../shared/lib/supabase', () => ({
  supabase: { rpc: mockRpc },
}))

vi.mock('../../shared/utils/db', () => ({
  orgQuery: mockOrgQuery,
}))

import DashboardPage from './index'

function emptyQuery() {
  return Promise.resolve({ data: [], error: null })
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOrgQuery.mockImplementation(emptyQuery)
    mockRpc.mockResolvedValue({ data: [], error: null })
  })

  it('keeps zero tiles and shows next-step CTAs for an empty org', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <DashboardPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Nothing on the board yet')).toBeInTheDocument()
    })

    expect(screen.getByText('Jobs today')).toBeInTheDocument()
    expect(screen.getAllByText('0').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$0.00').length).toBe(2)
    expect(screen.getByText('0 / 0')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add a truck' })).toHaveAttribute('href', '/trucks')
    expect(screen.getByRole('link', { name: 'Add a job' })).toHaveAttribute('href', '/jobs')
    expect(screen.getAllByRole('link', { name: 'Invite a driver' }).length).toBeGreaterThan(0)
    expect(screen.getByText('Dump')).toBeInTheDocument()
    expect(screen.getByText('Hydrovac')).toBeInTheDocument()
    expect(screen.getByText('Bin haul')).toBeInTheDocument()
    expect(screen.getByText('Water')).toBeInTheDocument()
  })

  it('hides the getting-started still when the org already has trucks', async () => {
    mockOrgQuery.mockImplementation((table: string) => {
      if (table === 'trucks') {
        return Promise.resolve({ data: [{ id: 't1', label: 'T-1' }], error: null })
      }
      return emptyQuery()
    })

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <DashboardPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('0 / 1')).toBeInTheDocument()
    })

    expect(screen.queryByText('Nothing on the board yet')).not.toBeInTheDocument()
    expect(screen.getByText('Jobs today')).toBeInTheDocument()
  })
})
