import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockUnsubscribe, mockGetSession, mockOnAuthStateChange, mockSignOut, mockFrom } = vi.hoisted(() => {
  const mockUnsubscribe = vi.fn()
  const mockGetSession = vi.fn()
  const mockOnAuthStateChange = vi.fn()
  const mockSignOut = vi.fn()
  const mockFrom = vi.fn()
  return { mockUnsubscribe, mockGetSession, mockOnAuthStateChange, mockSignOut, mockFrom }
})

vi.mock('../../shared/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: mockSignOut,
    },
    from: mockFrom,
  },
}))

import { AuthProvider, useAuth } from './AuthContext'

function buildFromChain(resolvedValue: unknown) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue(resolvedValue),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  return chain
}

function TestConsumer() {
  const { session, loading, role } = useAuth()
  if (loading) return <div>loading</div>
  return (
    <div>
      <span data-testid="session">{session ? 'authed' : 'anon'}</span>
      <span data-testid="role">{role ?? 'none'}</span>
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
    mockFrom.mockReturnValue(
      buildFromChain({ data: { role: 'dispatcher', orgs: { id: 'org-1', name: 'Acme Hauling' } } })
    )
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.queryByText('loading')).not.toBeInTheDocument())
    expect(screen.getByTestId('session').textContent).toBe('authed')
    expect(screen.getByTestId('role').textContent).toBe('dispatcher')
  })

  it('unsubscribes from auth state changes on unmount', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    const { unmount } = render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.queryByText('loading')).not.toBeInTheDocument())
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalled()
  })
})
