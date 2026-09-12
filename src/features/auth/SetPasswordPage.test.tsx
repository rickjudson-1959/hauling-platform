import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../shared/lib/supabase', () => ({
  supabase: {
    auth: { updateUser: vi.fn() },
  },
}))

vi.mock('./useAuth', () => ({
  useAuth: () => ({
    session: { user: { id: 'user-1' } },
    role: 'driver',
    loading: false,
  }),
}))

import SetPasswordPage from './SetPasswordPage'

describe('SetPasswordPage', () => {
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
})
