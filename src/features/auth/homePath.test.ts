import { describe, expect, it } from 'vitest'
import { homePath } from './homePath'

describe('homePath', () => {
  it('sends drivers to the mobile job list', () => {
    expect(homePath('driver')).toBe('/driver')
  })

  it('sends staff to the dashboard', () => {
    expect(homePath('admin')).toBe('/dashboard')
    expect(homePath('dispatcher')).toBe('/dashboard')
  })

  it('falls back to the dashboard when role is unknown', () => {
    expect(homePath(null)).toBe('/dashboard')
    expect(homePath(undefined)).toBe('/dashboard')
  })
})
