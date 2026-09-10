import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../shared/lib/supabase', () => ({
  supabase: {
    auth: { signInWithPassword: vi.fn() },
    functions: { invoke: vi.fn() },
  },
}))

import SignupPage from './SignupPage'

describe('SignupPage', () => {
  it('keeps the company form inside the shared hero shell', () => {
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    )

    expect(screen.getAllByText('Run your hauling day in one place.').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Create your company' })).toBeInTheDocument()
    expect(screen.getByLabelText('Company name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
    expect(document.body.textContent).not.toMatch(/book a bin/i)
    expect(document.body.textContent).not.toMatch(/roll-off/i)
    expect(document.body.textContent).not.toMatch(/marketplace/i)
  })
})
