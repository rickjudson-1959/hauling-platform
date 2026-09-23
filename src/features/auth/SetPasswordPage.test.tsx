import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../shared/lib/supabase', () => ({
  supabase: {
    auth: { updateUser: vi.fn() },
  },
}))

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}))

vi.mock('./useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

import SetPasswordPage from './SetPasswordPage'

describe('SetPasswordPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'user-1' } },
      role: 'driver',
      loading: false,
    })
  })

  it('shows password fields with show/hide toggles', () => {
    render(
      <MemoryRouter>
        <SetPasswordPage />
      </MemoryRouter>,
    )

    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Show confirm password' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('shows token-agnostic invalid-link copy when there is no session', () => {
    mockUseAuth.mockReturnValue({ session: null, role: null, loading: false })

    render(
      <MemoryRouter initialEntries={['/set-password']}>
        <SetPasswordPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'This link is invalid or expired' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Sign in if you already have a password, or ask the office for a new invite or password-reset email.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login')
    expect(screen.queryByText('Invite link expired')).not.toBeInTheDocument()
  })

  it('tweaks invalid-link copy when the URL indicates a recovery link', () => {
    mockUseAuth.mockReturnValue({ session: null, role: null, loading: false })

    render(
      <MemoryRouter initialEntries={['/set-password#type=recovery']}>
        <SetPasswordPage />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: 'This password-reset link is invalid or expired' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Sign in if you already have a password, or ask the office for a new password-reset email.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login')
  })
})
