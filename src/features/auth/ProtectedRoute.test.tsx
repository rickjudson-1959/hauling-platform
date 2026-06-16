import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const { mockUseAuth } = vi.hoisted(() => {
  const mockUseAuth = vi.fn()
  return { mockUseAuth }
})

vi.mock('./AuthContext', () => ({ useAuth: () => mockUseAuth() }))

import ProtectedRoute from './ProtectedRoute'

function renderInRouter(element: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/protected" element={element} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading indicator while auth is resolving', () => {
    mockUseAuth.mockReturnValue({ session: null, loading: true })
    renderInRouter(<ProtectedRoute><div>Secret</div></ProtectedRoute>)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
    expect(screen.queryByText('Secret')).not.toBeInTheDocument()
  })

  it('redirects to /login when there is no session', () => {
    mockUseAuth.mockReturnValue({ session: null, loading: false })
    renderInRouter(<ProtectedRoute><div>Secret</div></ProtectedRoute>)
    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Secret')).not.toBeInTheDocument()
  })

  it('renders children when a session exists', () => {
    mockUseAuth.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false })
    renderInRouter(<ProtectedRoute><div>Secret</div></ProtectedRoute>)
    expect(screen.getByText('Secret')).toBeInTheDocument()
  })
})
