import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockUnsubscribe, mockGetSession, mockOnAuthStateChange, mockSignOut, mockFetchActiveMembership } = vi.hoisted(() => {
  const mockUnsubscribe = vi.fn()
  const mockGetSession = vi.fn()
  const mockOnAuthStateChange = vi.fn()
  const mockSignOut = vi.fn()
  const mockFetchActiveMembership = vi.fn()
  return { mockUnsubscribe, mockGetSession, mockOnAuthStateChange, mockSignOut, mockFetchActiveMembership }
})

vi.mock('../../shared/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: mockSignOut,
    },
  },
}))

vi.mock('./activeMembership', async () => {
  const actual = await vi.importActual<typeof import('./activeMembership')>('./activeMembership')
  return { ...actual, fetchActiveMembership: mockFetchActiveMembership }
})

import { AuthProvider } from './AuthContext'
import { useAuth } from './useAuth'

function TestConsumer() {
  const { session, loading, role, org, membershipError } = useAuth()
  if (loading) return <div>loading</div>
  return (
    <div>
      <span data-testid="session">{session ? 'authed' : 'anon'}</span>
      <span data-testid="role">{role ?? 'none'}</span>
      <span data-testid="org">{org?.name ?? 'none'}</span>
      <span data-testid="membership-error">{membershipError ?? 'none'}</span>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    })
  })

  it('exposes null session when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.queryByText('loading')).not.toBeInTheDocument())
    expect(screen.getByTestId('session').textContent).toBe('anon')
  })

  it('fetches membership after session is established', async () => {
    const fakeSession = { user: { id: 'user-1' } }
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } })
    mockFetchActiveMembership.mockResolvedValue({
      status: 'active',
      membership: { role: 'dispatcher', orgId: 'org-1', orgName: 'Acme Hauling' },
    })
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.queryByText('loading')).not.toBeInTheDocument())
    expect(screen.getByTestId('session').textContent).toBe('authed')
    expect(screen.getByTestId('role').textContent).toBe('dispatcher')
    expect(screen.getByTestId('org').textContent).toBe('Acme Hauling')
    expect(screen.getByTestId('membership-error').textContent).toBe('none')
    expect(mockFetchActiveMembership).toHaveBeenCalled()
  })

  it('treats an inactive membership as no org access', async () => {
    const fakeSession = { user: { id: 'user-1' } }
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } })
    mockFetchActiveMembership.mockResolvedValue({ status: 'inactive' })
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.queryByText('loading')).not.toBeInTheDocument())
    expect(screen.getByTestId('role').textContent).toBe('none')
    expect(screen.getByTestId('org').textContent).toBe('none')
    expect(screen.getByTestId('membership-error').textContent).toBe('none')
  })

  it('does not treat a membership query error as inactive', async () => {
    const fakeSession = { user: { id: 'user-1' } }
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } })
    mockFetchActiveMembership.mockResolvedValue({
      status: 'error',
      message: 'Could not load your team membership. Try again, or ask your office if this keeps happening. (JWT expired)',
    })
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.queryByText('loading')).not.toBeInTheDocument())
    expect(screen.getByTestId('role').textContent).toBe('none')
    expect(screen.getByTestId('membership-error').textContent).toMatch(/JWT expired/)
    expect(screen.getByTestId('membership-error').textContent).not.toMatch(/not active on a team/)
  })

  it('unsubscribes from auth state changes on unmount', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    const { unmount } = render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.queryByText('loading')).not.toBeInTheDocument())
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalled()
  })
})
