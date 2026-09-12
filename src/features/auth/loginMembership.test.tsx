import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { INACTIVE_MEMBERSHIP_MESSAGE, MEMBERSHIP_LOAD_ERROR_FALLBACK } from './activeMembership'

const { mockSignIn, mockSignOut, mockNavigate, mockFetchActiveMembership } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  mockSignOut: vi.fn(),
  mockNavigate: vi.fn(),
  mockFetchActiveMembership: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../shared/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignIn,
      signOut: mockSignOut,
    },
  },
}))

vi.mock('./activeMembership', async () => {
  const actual = await vi.importActual<typeof import('./activeMembership')>('./activeMembership')
  return { ...actual, fetchActiveMembership: mockFetchActiveMembership }
})

import LoginPage from './index'

describe('LoginPage active membership gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignIn.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  })

  it('signs the user out when they have no active membership', async () => {
    const user = userEvent.setup()
    mockFetchActiveMembership.mockResolvedValue({ status: 'inactive' })

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('Email'), 'kim@hauling.local')
    await user.type(screen.getByLabelText('Password'), 'secret12')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
    })
    expect(screen.getByText(INACTIVE_MEMBERSHIP_MESSAGE)).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('continues to My Jobs when the membership is an active driver', async () => {
    const user = userEvent.setup()
    mockFetchActiveMembership.mockResolvedValue({
      status: 'active',
      membership: { role: 'driver', orgId: 'org-1', orgName: '+haul' },
    })

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('Email'), 'sheajudson84@gmail.com')
    await user.type(screen.getByLabelText('Password'), 'secret12')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/driver', { replace: true })
    })
    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it('continues to the office home when the membership is an active admin', async () => {
    const user = userEvent.setup()
    mockFetchActiveMembership.mockResolvedValue({
      status: 'active',
      membership: { role: 'admin', orgId: 'org-1', orgName: '+haul' },
    })

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('Email'), 'pat@hauling.local')
    await user.type(screen.getByLabelText('Password'), 'secret12')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it('does not sign the user out or claim they are inactive when membership loading fails', async () => {
    const user = userEvent.setup()
    mockFetchActiveMembership.mockResolvedValue({
      status: 'error',
      message: `${MEMBERSHIP_LOAD_ERROR_FALLBACK} (JWT expired)`,
    })

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('Email'), 'sheajudson84@gmail.com')
    await user.type(screen.getByLabelText('Password'), 'secret12')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(screen.getByText(/Could not load your team membership/)).toBeInTheDocument()
    })
    expect(screen.getByText(/JWT expired/)).toBeInTheDocument()
    expect(screen.queryByText(/not active on a team/)).not.toBeInTheDocument()
    expect(mockSignOut).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
