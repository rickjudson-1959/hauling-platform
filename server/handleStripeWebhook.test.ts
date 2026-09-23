import { afterEach, describe, expect, it, vi } from 'vitest'
import Stripe from 'stripe'
import { handleStripeWebhook, requireTestStripeSecret } from './handleStripeWebhook.js'

const WEBHOOK_SECRET = 'whsec_test_secret'
const TEST_KEY = 'sk_test_dummy'

function signedPayload(event: unknown) {
  const payload = JSON.stringify(event)
  const stripe = new Stripe(TEST_KEY)
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  })
  return { payload, signature }
}

describe('requireTestStripeSecret', () => {
  it('accepts Hauling test secrets and rejects live keys', () => {
    expect(requireTestStripeSecret('sk_test_abc')).toBe('sk_test_abc')
    expect(requireTestStripeSecret('rk_test_abc')).toBe('rk_test_abc')
    expect(requireTestStripeSecret('  "sk_test_abc"\n')).toBe('sk_test_abc')
    expect(requireTestStripeSecret("'rk_test_abc'\r\n")).toBe('rk_test_abc')
    expect(() => requireTestStripeSecret('sk_live_abc')).toThrow(/Live Stripe keys/)
    expect(() => requireTestStripeSecret('rk_live_abc')).toThrow(/Live Stripe keys/)
    expect(() => requireTestStripeSecret('"sk_live_abc"\n')).toThrow(/Live Stripe keys/)
    expect(() => requireTestStripeSecret(undefined)).toThrow(/not set/)
    expect(() => requireTestStripeSecret('  \n')).toThrow(/not set/)
    expect(() => requireTestStripeSecret('sk_not_a_mode')).toThrow(/sk_test_ or rk_test_/)
  })
})

describe('handleStripeWebhook', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rejects a missing signature before looking at server secrets', async () => {
    await expect(handleStripeWebhook('{}', undefined)).rejects.toThrow(/Missing stripe-signature/)
  })

  it('rejects an invalid signature', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET)
    vi.stubEnv('STRIPE_SECRET_KEY', TEST_KEY)
    await expect(
      handleStripeWebhook('{"id":"evt_probe"}', 't=1720000000,v1=deadbeef'),
    ).rejects.toThrow(/signature/)
  })

  it('verifies a signed payload when the webhook secret has a trailing newline', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', `${WEBHOOK_SECRET}\n`)
    vi.stubEnv('STRIPE_SECRET_KEY', `${TEST_KEY}\n`)
    const { payload, signature } = signedPayload({
      id: 'evt_test_trimmed_newline',
      object: 'event',
      type: 'customer.created',
      data: { object: { id: 'cus_test', object: 'customer' } },
    })
    await expect(handleStripeWebhook(payload, signature)).resolves.toEqual({
      received: true,
      ignored: 'customer.created',
    })
  })

  it('verifies a signed payload when the webhook secret is wrapped in quotes', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', `"${WEBHOOK_SECRET}"\n`)
    vi.stubEnv('STRIPE_SECRET_KEY', `'${TEST_KEY}'`)
    const { payload, signature } = signedPayload({
      id: 'evt_test_trimmed_quotes',
      object: 'event',
      type: 'customer.created',
      data: { object: { id: 'cus_test', object: 'customer' } },
    })
    await expect(handleStripeWebhook(payload, signature)).resolves.toEqual({
      received: true,
      ignored: 'customer.created',
    })
  })

  it('acknowledges a signed test event that is not an on-site payment', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET)
    vi.stubEnv('STRIPE_SECRET_KEY', TEST_KEY)
    const { payload, signature } = signedPayload({
      id: 'evt_test_ignored',
      object: 'event',
      type: 'customer.created',
      data: { object: { id: 'cus_test', object: 'customer' } },
    })
    await expect(handleStripeWebhook(payload, signature)).resolves.toEqual({
      received: true,
      ignored: 'customer.created',
    })
  })

  it('acknowledges a signed payment event that has no job metadata', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET)
    vi.stubEnv('STRIPE_SECRET_KEY', TEST_KEY)
    const { payload, signature } = signedPayload({
      id: 'evt_test_pi',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test',
          object: 'payment_intent',
          amount: 2500,
          currency: 'cad',
          metadata: {},
          latest_charge: null,
        },
      },
    })
    await expect(handleStripeWebhook(payload, signature)).resolves.toEqual({
      received: true,
      ignored: 'missing job or org metadata',
    })
  })

  it('refuses to construct a client from a live secret', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET)
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_nope')
    const { payload, signature } = signedPayload({
      id: 'evt_live_guard',
      object: 'event',
      type: 'customer.created',
      data: { object: { id: 'cus_test', object: 'customer' } },
    })
    await expect(handleStripeWebhook(payload, signature)).rejects.toThrow(/Live Stripe keys/)
  })
})
