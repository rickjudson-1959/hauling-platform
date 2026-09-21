import { afterEach, describe, expect, it, vi } from 'vitest'
import Stripe from 'stripe'
import { OPTIONS, POST } from './webhook.js'

const WEBHOOK_SECRET = 'whsec_test_secret'
const TEST_KEY = 'sk_test_dummy'

function webhookRequest(body: string, signature?: string) {
  const headers = new Headers()
  if (signature) headers.set('stripe-signature', signature)
  return new Request('https://hauling-platform.vercel.app/api/stripe/webhook', {
    method: 'POST',
    headers,
    body,
  })
}

describe('POST /api/stripe/webhook', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 400 JSON when the signature header is missing', async () => {
    const res = await POST(webhookRequest(''))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Missing stripe-signature' })
  })

  it('returns 400 JSON for an invalid signature', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET)
    vi.stubEnv('STRIPE_SECRET_KEY', TEST_KEY)
    const res = await POST(webhookRequest('{"id":"evt_probe"}', 't=1720000000,v1=deadbeef'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/signature/)
  })

  it('returns 200 JSON for a signed test event using the exact raw body', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET)
    vi.stubEnv('STRIPE_SECRET_KEY', TEST_KEY)
    const payload = JSON.stringify({
      id: 'evt_test_ignored',
      object: 'event',
      type: 'customer.created',
      data: { object: { id: 'cus_test', object: 'customer' } },
    })
    const signature = new Stripe(TEST_KEY).webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    })
    const res = await POST(webhookRequest(payload, signature))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, ignored: 'customer.created' })
  })

  it('returns 200 for OPTIONS', async () => {
    const res = OPTIONS()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })
})
