import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleStripeWebhook } from '../../server/handleStripeWebhook.js'

function readRawBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof req.on !== 'function') {
      reject(new Error('Unable to read raw request body'))
      return
    }
    const chunks: Buffer[] = []
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve(Buffer.concat(chunks).toString('utf8'))
    }
    const fail = (err: unknown) => {
      if (settled) return
      settled = true
      reject(err instanceof Error ? err : new Error(String(err)))
    }
    req.on('data', chunk => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    req.on('end', finish)
    req.on('error', fail)
    if (req.readableEnded) finish()
  })
}

function statusForWebhookError(message: string): number {
  if (
    message.includes('signature') ||
    message.includes('Missing stripe-signature') ||
    message.includes('No webhook payload') ||
    message.includes('Timestamp outside the tolerance zone')
  ) {
    return 400
  }
  return 500
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 200
    res.end('ok')
    return
  }
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    const rawBody = await readRawBody(req)
    const signature = req.headers['stripe-signature']
    const sig = Array.isArray(signature) ? signature[0] : signature
    const result = await handleStripeWebhook(rawBody, sig)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const status = statusForWebhookError(msg)
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: msg }))
  }
}
