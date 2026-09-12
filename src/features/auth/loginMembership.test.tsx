import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSignIn, mockSignOut, mockFrom, mockNavigate } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  mockSignOut: vi.fn(),
  mockFrom: vi.fn(),
  mockNavigate: vi.fn(),
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
    from: mockFrom,
  },
}))

import LoginPage from './index'

function membershipChain(resolved: unknown) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(resolved),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  return chain
}

describe('LoginPage active membership gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignIn.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  })

  it('signs the user out when they have no active membership', async () => {
    const user = userEvent.setup()
    const chain = membershipChain({ data: null })
    mockFrom.mockReturnValue(chain)

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
    expect(chain.eq).toHaveBeenCalledWith('status', 'active')
    expect(screen.getByText(/Your account is not active on a team/)).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('continues to the office home when the membership is active', async () => {
    const user = userEvent.setup()
    mockFrom.mockReturnValue(membershipChain({ data: { role: 'admin' } }))

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
})
