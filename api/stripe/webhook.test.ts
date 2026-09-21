import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Stripe from 'stripe'
import handler from './webhook.js'

const WEBHOOK_SECRET = 'whsec_test_secret'
const TEST_KEY = 'sk_test_dummy'

function mockRequest(method: string, body: string, signature?: string) {
  const req = new EventEmitter() as IncomingMessage
  req.method = method
  req.headers = signature ? { 'stripe-signature': signature } : {}
  queueMicrotask(() => {
    req.emit('data', Buffer.from(body))
    req.emit('end')
  })
  return req
}

function mockResponse() {
  const res = {
    statusCode: 0,
    body: '',
    setHeader() {
      return this
    },
    end(payload?: string) {
      this.body = payload ?? ''
    },
  }
  return res as ServerResponse & { statusCode: number; body: string }
}

describe('POST /api/stripe/webhook', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 400 JSON when the signature header is missing', async () => {
    const res = mockResponse()
    await handler(mockRequest('POST', ''), res)
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toEqual({ error: 'Missing stripe-signature' })
  })

  it('returns 400 JSON for an invalid signature', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET)
    vi.stubEnv('STRIPE_SECRET_KEY', TEST_KEY)
    const res = mockResponse()
    await handler(
      mockRequest('POST', '{"id":"evt_probe"}', 't=1720000000,v1=deadbeef'),
      res,
    )
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error).toMatch(/signature/)
  })

  it('returns 200 JSON for a signed test event', async () => {
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
    const res = mockResponse()
    await handler(mockRequest('POST', payload, signature), res)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ received: true, ignored: 'customer.created' })
  })

  it('returns 405 JSON for non-POST methods', async () => {
    const res = mockResponse()
    await handler(mockRequest('GET', ''), res)
    expect(res.statusCode).toBe(405)
    expect(JSON.parse(res.body)).toEqual({ error: 'Method not allowed' })
  })
})
