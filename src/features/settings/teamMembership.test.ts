import { describe, expect, it } from 'vitest'
import {
  canDeactivateOrRemove,
  isActiveMember,
  isLastActiveAdmin,
  normalizeMembershipStatus,
  OPEN_JOB_STATUSES,
} from './teamMembership'

function member(partial: Partial<{
  membership_id: string
  user_id: string
  role: string
  email: string
  status: 'active' | 'inactive'
}> = {}) {
  return {
    membership_id: 'm-1',
    user_id: 'u-1',
    role: 'driver',
    email: 'driver@example.com',
    status: 'active' as const,
    ...partial,
  }
}

describe('normalizeMembershipStatus', () => {
  it('treats missing or unknown values as active', () => {
    expect(normalizeMembershipStatus(undefined)).toBe('active')
    expect(normalizeMembershipStatus(null)).toBe('active')
    expect(normalizeMembershipStatus('active')).toBe('active')
    expect(normalizeMembershipStatus('inactive')).toBe('inactive')
  })
})

describe('isActiveMember', () => {
  it('is true only for the active status', () => {
    expect(isActiveMember(member({ status: 'active' }))).toBe(true)
    expect(isActiveMember(member({ status: 'inactive' }))).toBe(false)
  })
})

describe('isLastActiveAdmin', () => {
  it('is true for the only active admin', () => {
    const solo = member({ membership_id: 'admin-1', role: 'admin' })
    expect(isLastActiveAdmin(solo, [solo, member({ membership_id: 'drv-1' })])).toBe(true)
  })

  it('is false when another active admin exists', () => {
    const a = member({ membership_id: 'admin-1', role: 'admin' })
    const b = member({ membership_id: 'admin-2', user_id: 'u-2', role: 'admin', email: 'b@example.com' })
    expect(isLastActiveAdmin(a, [a, b])).toBe(false)
  })

  it('ignores inactive admins when deciding who is last', () => {
    const active = member({ membership_id: 'admin-1', role: 'admin' })
    const inactive = member({
      membership_id: 'admin-2',
      user_id: 'u-2',
      role: 'admin',
      email: 'old@example.com',
      status: 'inactive',
    })
    expect(isLastActiveAdmin(active, [active, inactive])).toBe(true)
    expect(isLastActiveAdmin(inactive, [active, inactive])).toBe(false)
  })

  it('is false for drivers and dispatchers', () => {
    const driver = member({ role: 'driver' })
    const dispatcher = member({ membership_id: 'disp-1', role: 'dispatcher' })
    const admin = member({ membership_id: 'admin-1', role: 'admin' })
    expect(isLastActiveAdmin(driver, [driver, admin])).toBe(false)
    expect(isLastActiveAdmin(dispatcher, [dispatcher, admin])).toBe(false)
  })
})

describe('canDeactivateOrRemove', () => {
  it('blocks the last active admin, including yourself', () => {
    const me = member({ membership_id: 'admin-1', role: 'admin' })
    expect(canDeactivateOrRemove(me, [me])).toBe(false)
  })

  it('allows deactivate and remove when another admin is active', () => {
    const me = member({ membership_id: 'admin-1', role: 'admin' })
    const other = member({ membership_id: 'admin-2', role: 'admin', user_id: 'u-2' })
    const driver = member({ membership_id: 'drv-1' })
    expect(canDeactivateOrRemove(me, [me, other, driver])).toBe(true)
    expect(canDeactivateOrRemove(driver, [me, other, driver])).toBe(true)
  })

  it('allows removing an inactive member even if they were an admin', () => {
    const admin = member({ membership_id: 'admin-1', role: 'admin' })
    const former = member({
      membership_id: 'admin-2',
      role: 'admin',
      status: 'inactive',
    })
    expect(canDeactivateOrRemove(former, [admin, former])).toBe(true)
  })
})

describe('OPEN_JOB_STATUSES', () => {
  it('lists the in-progress statuses that deactivate and remove unassign', () => {
    expect(OPEN_JOB_STATUSES).toEqual(['scheduled', 'assigned', 'en_route', 'on_site'])
  })
})
