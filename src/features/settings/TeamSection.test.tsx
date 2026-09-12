import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRpc, mockFrom, mockInvoke, mockUseAuth } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockInvoke: vi.fn(),
  mockUseAuth: vi.fn(),
}))

vi.mock('../auth/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../shared/lib/supabase', () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom,
    functions: { invoke: mockInvoke },
  },
}))

import TeamSection, { INVITE_SET_PASSWORD_REDIRECT } from './TeamSection'

const adminUser = { id: 'user-admin' }
const members = [
  {
    membership_id: 'mem-admin',
    user_id: 'user-admin',
    role: 'admin',
    email: 'pat@hauling.local',
    active: true,
  },
  {
    membership_id: 'mem-driver',
    user_id: 'user-driver',
    role: 'driver',
    email: 'kim@hauling.local',
    active: true,
  },
  {
    membership_id: 'mem-inactive',
    user_id: 'user-old',
    role: 'driver',
    email: 'lee@hauling.local',
    active: false,
  },
]

function rowFor(email: string) {
  return screen.getByText(email).closest('tr') as HTMLElement
}

describe('TeamSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      org: { id: 'org-1', name: 'Acme Hauling' },
      role: 'admin',
      user: adminUser,
    })
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'org_members') return Promise.resolve({ data: members, error: null })
      return Promise.resolve({ data: null, error: null })
    })
  })

  it('shows Active and Inactive badges and last-admin guards on yourself', async () => {
    render(<TeamSection />)

    await waitFor(() => {
      expect(screen.getByText('kim@hauling.local')).toBeInTheDocument()
    })

    expect(within(rowFor('pat@hauling.local')).getByText('Active')).toBeInTheDocument()
    expect(within(rowFor('kim@hauling.local')).getByText('Active')).toBeInTheDocument()
    expect(within(rowFor('lee@hauling.local')).getByText('Inactive')).toBeInTheDocument()

    const selfRow = rowFor('pat@hauling.local')
    expect(within(selfRow).getByRole('button', { name: 'Deactivate' })).toBeDisabled()
    expect(within(selfRow).getByRole('button', { name: 'Remove from team' })).toBeDisabled()
    expect(within(selfRow).getByText('You need another admin before you can deactivate or remove this person.')).toBeInTheDocument()

    expect(within(rowFor('kim@hauling.local')).getByRole('button', { name: 'Deactivate' })).toBeEnabled()
    expect(within(rowFor('lee@hauling.local')).getByRole('button', { name: 'Reactivate' })).toBeEnabled()
  })

  it('deactivates a driver through the membership RPC', async () => {
    const user = userEvent.setup()
    render(<TeamSection />)
    await waitFor(() => expect(screen.getByText('kim@hauling.local')).toBeInTheDocument())

    await user.click(within(rowFor('kim@hauling.local')).getByRole('button', { name: 'Deactivate' }))

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('deactivate_membership', { p_membership_id: 'mem-driver' })
    })
    expect(within(rowFor('kim@hauling.local')).getByText('Inactive')).toBeInTheDocument()
    expect(within(rowFor('kim@hauling.local')).getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
  })

  it('reactivates an inactive member', async () => {
    const user = userEvent.setup()
    render(<TeamSection />)
    await waitFor(() => expect(screen.getByText('lee@hauling.local')).toBeInTheDocument())

    await user.click(within(rowFor('lee@hauling.local')).getByRole('button', { name: 'Reactivate' }))

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('reactivate_membership', { p_membership_id: 'mem-inactive' })
    })
    expect(within(rowFor('lee@hauling.local')).getByText('Active')).toBeInTheDocument()
  })

  it('warns that open jobs will be unassigned before removing a member', async () => {
    const user = userEvent.setup()
    render(<TeamSection />)
    await waitFor(() => expect(screen.getByText('kim@hauling.local')).toBeInTheDocument())

    await user.click(within(rowFor('kim@hauling.local')).getByRole('button', { name: 'Remove from team' }))

    const dialog = screen.getByRole('heading', { name: 'Remove from team' }).closest('div')?.parentElement as HTMLElement
    expect(screen.getByText(/Open jobs assigned to them will be unassigned/)).toBeInTheDocument()
    expect(screen.getByText(/Their login account stays so you can invite them again later/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/—/)

    await user.click(within(dialog).getByRole('button', { name: 'Remove from team' }))

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('remove_membership', { p_membership_id: 'mem-driver' })
    })
    expect(screen.queryByText('kim@hauling.local')).not.toBeInTheDocument()
  })

  it('sends invite redirectTo to the production set-password page', async () => {
    const user = userEvent.setup()
    mockInvoke.mockResolvedValue({ data: { success: true, isNew: true, inviteLink: 'https://example.test/invite' }, error: null })
    render(<TeamSection />)
    await waitFor(() => expect(screen.getByText('kim@hauling.local')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText('driver@example.com'), 'new@hauling.local')
    await user.click(screen.getByRole('button', { name: 'Invite' }))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('invite-member', {
        body: {
          email: 'new@hauling.local',
          role: 'driver',
          redirectTo: INVITE_SET_PASSWORD_REDIRECT,
        },
      })
    })
    expect(INVITE_SET_PASSWORD_REDIRECT).toBe('https://hauling-platform.vercel.app/set-password')
  })

  it('lets a second admin deactivate themselves', async () => {
    const twoAdmins = [
      ...members,
      {
        membership_id: 'mem-admin-2',
        user_id: 'user-admin-2',
        role: 'admin',
        email: 'sam@hauling.local',
        active: true,
      },
    ]
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'org_members') return Promise.resolve({ data: twoAdmins, error: null })
      return Promise.resolve({ data: null, error: null })
    })
    const user = userEvent.setup()
    render(<TeamSection />)
    await waitFor(() => expect(screen.getByText('sam@hauling.local')).toBeInTheDocument())

    const selfDeactivate = within(rowFor('pat@hauling.local')).getByRole('button', { name: 'Deactivate' })
    expect(selfDeactivate).toBeEnabled()
    await user.click(selfDeactivate)
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('deactivate_membership', { p_membership_id: 'mem-admin' })
    })
  })
})
