import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../shared/lib/supabase', () => ({
  supabase: {
    auth: { signInWithPassword: vi.fn() },
    from: vi.fn(),
  },
}))

import LoginPage from './index'

describe('LoginPage', () => {
  it('shows the truck-forward hero copy, trust row, and working sign-in fields', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    expect(screen.getAllByText('Run your hauling day in one place.').length).toBeGreaterThan(0)
    expect(
      screen.getAllByText('Trucks, jobs, drivers, and invoices without the spreadsheet mess.').length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText('Open the dashboard').length).toBeGreaterThan(0)
    expect(screen.getAllByText('dispatch').length).toBeGreaterThan(0)
    expect(screen.getAllByText('trucks').length).toBeGreaterThan(0)
    expect(screen.getAllByText('drivers').length).toBeGreaterThan(0)
    expect(screen.getAllByText('invoices').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/signup')
    expect(document.body.textContent).not.toMatch(/book a bin/i)
    const heroSrcs = Array.from(document.querySelectorAll('img')).map(el => el.getAttribute('src') ?? '')
    expect(heroSrcs.some(src => src.includes('v3-dump-truck.jpg'))).toBe(true)
    expect(heroSrcs.some(src => src.includes('v3-hydrovac-truck.jpg'))).toBe(true)
    expect(heroSrcs.some(src => src.includes('v3-bin-haul-truck.jpg'))).toBe(true)
    expect(heroSrcs.some(src => src.includes('v3-water-truck.jpg'))).toBe(true)
  })
})
