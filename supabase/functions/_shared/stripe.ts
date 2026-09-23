import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno'

/** Dashboard/Vercel pastes often include a trailing newline or wrapping quotes. */
export function normalizeStripeEnvValue(value: string | undefined): string {
  if (!value) return ''
  let normalized = value.trim()
  if (
    normalized.length >= 2 &&
    ((normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'")))
  ) {
    normalized = normalized.slice(1, -1).trim()
  }
  return normalized
}

export function requireTestStripeSecret(): string {
  const key = normalizeStripeEnvValue(Deno.env.get('STRIPE_SECRET_KEY'))
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  if (key.startsWith('sk_live') || key.startsWith('rk_live')) {
    throw new Error('Live Stripe keys are not allowed. Use the Hauling Stripe TEST secret.')
  }
  if (!key.startsWith('sk_test') && !key.startsWith('rk_test')) {
    throw new Error('STRIPE_SECRET_KEY must be a Hauling Stripe TEST key (sk_test_ or rk_test_).')
  }
  return key
}

export function requireTestPublishableKey(): string {
  const key = Deno.env.get('STRIPE_PUBLISHABLE_KEY') ?? ''
  if (!key) throw new Error('STRIPE_PUBLISHABLE_KEY is not set')
  if (key.startsWith('pk_live')) {
    throw new Error('Live Stripe publishable keys are not allowed. Use the Hauling Stripe TEST publishable key.')
  }
  if (!key.startsWith('pk_test')) {
    throw new Error('STRIPE_PUBLISHABLE_KEY must be a Hauling Stripe TEST key (pk_test_).')
  }
  return key
}

export function stripeClient() {
  return new Stripe(requireTestStripeSecret(), {
    httpClient: Stripe.createFetchHttpClient(),
  })
}

export { Stripe }
