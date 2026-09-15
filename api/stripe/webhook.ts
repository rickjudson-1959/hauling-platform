import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleStripeWebhook } from '../../server/handleStripeWebhook'

export const config = {
  api: { bodyParser: false },
}

function readRawBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', chunk => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
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
    const status = msg.includes('signature') || msg.includes('Missing stripe-signature') ? 400 : 500
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: msg }))
  }
}
