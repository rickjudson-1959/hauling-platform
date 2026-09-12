import { describe, expect, it } from 'vitest'
import { requireTestStripeSecret } from './handleStripeWebhook'

describe('requireTestStripeSecret', () => {
  it('accepts Hauling test secrets and rejects live keys', () => {
    expect(requireTestStripeSecret('sk_test_abc')).toBe('sk_test_abc')
    expect(requireTestStripeSecret('rk_test_abc')).toBe('rk_test_abc')
    expect(() => requireTestStripeSecret('sk_live_abc')).toThrow(/Live Stripe keys/)
    expect(() => requireTestStripeSecret(undefined)).toThrow(/not set/)
  })
})
