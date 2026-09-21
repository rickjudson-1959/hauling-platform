import { handleStripeWebhook } from '../../server/handleStripeWebhook.js'

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

function json(body: unknown, status: number): Response {
  return Response.json(body, { status })
}

export function OPTIONS(): Response {
  return new Response('ok', { status: 200 })
}

export async function POST(request: Request): Promise<Response> {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('stripe-signature') ?? undefined
    const result = await handleStripeWebhook(rawBody, signature)
    return json(result, 200)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return json({ error: msg }, statusForWebhookError(msg))
  }
}
