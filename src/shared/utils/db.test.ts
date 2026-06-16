import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockChain, mockFrom } = vi.hoisted(() => {
  const mockChain = {
    eq: vi.fn(),
    select: vi.fn(),
  }
  mockChain.eq.mockReturnValue(mockChain)
  mockChain.select.mockReturnValue(mockChain)

  const mockFrom = vi.fn().mockReturnValue(mockChain)

  return { mockChain, mockFrom }
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

import { orgQuery } from './db'

describe('orgQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue(mockChain)
    mockChain.select.mockReturnValue(mockChain)
    mockChain.eq.mockReturnValue(mockChain)
  })

  it('calls from() with the correct table name', () => {
    orgQuery('jobs', 'org-123')
    expect(mockFrom).toHaveBeenCalledWith('jobs')
  })

  it('calls select() before eq() to produce a valid filter builder', () => {
    orgQuery('jobs', 'org-123')
    expect(mockChain.select).toHaveBeenCalledWith('*')
  })

  it('applies an org_id filter', () => {
    orgQuery('jobs', 'org-123')
    expect(mockChain.eq).toHaveBeenCalledWith('org_id', 'org-123')
  })

  it('returns the chainable query builder', () => {
    const result = orgQuery('jobs', 'org-123')
    expect(result).toBe(mockChain)
  })

  it('accepts a custom columns argument', () => {
    orgQuery('jobs', 'org-123', 'id, status')
    expect(mockChain.select).toHaveBeenCalledWith('id, status')
  })
})
