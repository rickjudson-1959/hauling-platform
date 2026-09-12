import { describe, expect, it, vi } from 'vitest'

vi.mock('../../shared/lib/supabase', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}))

import {
  fetchActiveMembership,
  INACTIVE_MEMBERSHIP_MESSAGE,
  MEMBERSHIP_LOAD_ERROR_FALLBACK,
  type MembershipClient,
} from './activeMembership'

function rpcClient(handlers: Record<string, { data?: unknown; error?: { message?: string; code?: string } | null }>): MembershipClient {
  return {
    rpc: vi.fn(async (fn: 'my_active_membership' | 'my_role' | 'my_org_id') => {
      const result = handlers[fn]
      if (!result) return { data: null, error: { message: `unexpected rpc ${fn}` } }
      return { data: result.data ?? null, error: result.error ?? null }
    }),
  }
}

describe('fetchActiveMembership', () => {
  it('returns an active driver from my_active_membership', async () => {
    const client = rpcClient({
      my_active_membership: {
        data: [{ role: 'driver', org_id: 'org-1', org_name: '+haul' }],
      },
    })

    await expect(fetchActiveMembership(client)).resolves.toEqual({
      status: 'active',
      membership: { role: 'driver', orgId: 'org-1', orgName: '+haul' },
    })
  })

  it('treats a clean empty RPC result as inactive, not an error', async () => {
    const client = rpcClient({
      my_active_membership: { data: [] },
    })

    await expect(fetchActiveMembership(client)).resolves.toEqual({ status: 'inactive' })
    expect(INACTIVE_MEMBERSHIP_MESSAGE).toMatch(/not active on a team/)
  })

  it('surfaces a query error instead of claiming the membership is inactive', async () => {
    const client = rpcClient({
      my_active_membership: { error: { message: 'permission denied for table memberships', code: '42501' } },
    })

    const result = await fetchActiveMembership(client)
    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('expected error')
    expect(result.message).toContain(MEMBERSHIP_LOAD_ERROR_FALLBACK)
    expect(result.message).toContain('permission denied for table memberships')
    expect(result.message).not.toMatch(/not active on a team/)
  })

  it('falls back to my_role / my_org_id when the dedicated RPC is not deployed yet', async () => {
    const client = rpcClient({
      my_active_membership: {
        error: { code: 'PGRST202', message: 'Could not find the function public.my_active_membership without parameters in the schema cache' },
      },
      my_role: { data: 'driver' },
      my_org_id: { data: 'org-1' },
    })

    await expect(fetchActiveMembership(client)).resolves.toEqual({
      status: 'active',
      membership: { role: 'driver', orgId: 'org-1', orgName: '' },
    })
  })

  it('does not treat a fallback helper error as inactive', async () => {
    const client = rpcClient({
      my_active_membership: { error: { code: 'PGRST202', message: 'Could not find the function public.my_active_membership' } },
      my_role: { error: { message: 'JWT expired' } },
      my_org_id: { data: null },
    })

    const result = await fetchActiveMembership(client)
    expect(result.status).toBe('error')
    if (result.status !== 'error') throw new Error('expected error')
    expect(result.message).toContain('JWT expired')
    expect(result.message).not.toMatch(/not active on a team/)
  })
})
